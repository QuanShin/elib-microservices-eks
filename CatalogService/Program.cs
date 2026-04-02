using System.Globalization; // CSV parsing culture support.
using CatalogService.Data; // Catalog DbContext.
using CatalogService.DTOs; // DTOs for create/import.
using CatalogService.Models; // Book model.
using CsvHelper; // CSV parser.
using CsvHelper.Configuration; // CSV parser config.
using Microsoft.AspNetCore.Authentication.JwtBearer; // JWT auth middleware.
using Microsoft.EntityFrameworkCore; // EF Core.
using Microsoft.IdentityModel.Tokens; // Token validation + JsonWebKeySet.
using Microsoft.AspNetCore.Http.Features;

var builder = WebApplication.CreateBuilder(args); // Create ASP.NET builder.

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 100 * 1024 * 1024; // Allow uploads up to 100 MB.
});

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 100 * 1024 * 1024; // Allow multipart form uploads up to 100 MB.
});

// Load appsettings then env vars.
builder.Configuration.AddJsonFile("appsettings.json", optional: true); // Base config.
builder.Configuration.AddEnvironmentVariables(); // Env overrides.

// Read required config or fail fast.
string GetRequired(string key)
{
    var value = builder.Configuration[key]; // Read config value.
    if (string.IsNullOrWhiteSpace(value)) // Fail if missing.
        throw new InvalidOperationException($"Missing configuration: {key}");
    return value;
}

// Read DB connection string from either full string or split Database config.
string GetConnectionString()
{
    var direct = builder.Configuration["ConnectionStrings:Default"]; // Prefer full connection string.
    if (!string.IsNullOrWhiteSpace(direct))
        return direct;

    var host = builder.Configuration["Database:Host"];
    var port = builder.Configuration["Database:Port"];
    var name = builder.Configuration["Database:Name"];
    var user = builder.Configuration["Database:User"];
    var password = builder.Configuration["Database:Password"];

    if (string.IsNullOrWhiteSpace(host) ||
        string.IsNullOrWhiteSpace(port) ||
        string.IsNullOrWhiteSpace(name) ||
        string.IsNullOrWhiteSpace(user) ||
        string.IsNullOrWhiteSpace(password))
    {
        throw new InvalidOperationException(
            "Missing database configuration. Provide either ConnectionStrings:Default or Database:Host/Port/Name/User/Password."
        );
    }

    return $"server={host};port={port};database={name};user={user};password={password}";
}

// Load JWKS directly instead of using OpenID metadata loader.
async Task<ICollection<SecurityKey>> LoadSigningKeysAsync(string jwksUrl)
{
    using var http = new HttpClient(); // Simple startup HTTP client.
    var jwksJson = await http.GetStringAsync(jwksUrl); // Download JWKS JSON.
    var jwks = new JsonWebKeySet(jwksJson); // Parse JWKS.
    return jwks.GetSigningKeys(); // Extract signing keys.
}

var connStr = GetConnectionString(); // Resolve DB connection.
var issuer = GetRequired("Jwt:Issuer"); // Expected issuer.
var audience = GetRequired("Jwt:Audience"); // Expected audience.
var jwksUrl = GetRequired("Jwt:JwksUrl"); // JWKS URL from AuthService.
var signingKeys = await LoadSigningKeysAsync(jwksUrl); // Load JWKS keys once at startup.

// Register DB context.
builder.Services.AddDbContext<CatalogDbContext>(options =>
    options.UseMySql(
        connStr,
        new MySqlServerVersion(new Version(8, 4, 7)),
        mySqlOptions => mySqlOptions.EnableRetryOnFailure()
    ));

// Configure JWT auth using direct JWKS keys.
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false; // IMPORTANT: keep JWT claim names exactly as they are.
        options.RequireHttpsMetadata = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = signingKeys,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

// Admin policy.
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireClaim("role", "ADMIN"));
});

// CORS policy.
builder.Services.AddCors(options =>
{
    options.AddPolicy("Default", policy =>
    {
        policy
            .AllowAnyHeader()
            .AllowAnyMethod()
            .SetIsOriginAllowed(_ => true)
            .AllowCredentials();
    });
});

var app = builder.Build(); // Build app.

app.UseCors("Default"); // Enable CORS.
app.UseAuthentication(); // Enable auth.
app.UseAuthorization(); // Enable authorization.

// Auto-apply migrations.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
    await db.Database.MigrateAsync();
}

// Normalize category values.
static string NormalizeCategory(string raw)
{
    return string.Join(", ",
        raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
}

// Shared mapper for manual create + CSV import.
static Book MapToBook(
    string title,
    string author,
    string category,
    string? description,
    string? publisher,
    decimal? price,
    string? publishMonth,
    int year,
    string? isbn = null)
{
    return new Book
    {
        Title = title.Trim(),
        Author = author.Replace("By ", "", StringComparison.OrdinalIgnoreCase).Trim(),
        Category = NormalizeCategory(category),
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
        Publisher = string.IsNullOrWhiteSpace(publisher) ? null : publisher.Trim(),
        Price = price,
        PublishMonth = string.IsNullOrWhiteSpace(publishMonth) ? null : publishMonth.Trim(),
        Year = year,
        Isbn = string.IsNullOrWhiteSpace(isbn) ? null : isbn.Trim()
    };
}

// Validate manual create/update input.
static IResult? ValidateBook(BookCreate req)
{
    if (string.IsNullOrWhiteSpace(req.Title))
        return Results.BadRequest(new { error = "Title is required." });

    if (string.IsNullOrWhiteSpace(req.Author))
        return Results.BadRequest(new { error = "Author is required." });

    if (string.IsNullOrWhiteSpace(req.Category))
        return Results.BadRequest(new { error = "Category is required." });

    if (req.Year < 0 || req.Year > DateTime.UtcNow.Year + 1)
        return Results.BadRequest(new { error = "Invalid year." });

    return null;
}

// Health.
app.MapGet("/catalog/health", () => Results.Ok(new { ok = true }));

// List/search books.
app.MapGet("/catalog/books", async (CatalogDbContext db, string? query, string? category) =>
{
    var books = db.Books.AsQueryable();

    if (!string.IsNullOrWhiteSpace(query))
    {
        var q = query.Trim().ToLower();
        books = books.Where(x =>
            x.Title.ToLower().Contains(q) ||
            x.Author.ToLower().Contains(q) ||
            (x.Description != null && x.Description.ToLower().Contains(q)));
    }

    if (!string.IsNullOrWhiteSpace(category))
    {
        var c = category.Trim().ToLower();
        books = books.Where(x => x.Category.ToLower().Contains(c));
    }

    return Results.Ok(await books
        .OrderBy(x => x.Title)
        .Take(500)
        .ToListAsync());
});

// Get one book.
app.MapGet("/catalog/books/{id:int}", async (CatalogDbContext db, int id) =>
{
    var book = await db.Books.FindAsync(id);
    return book is null ? Results.NotFound() : Results.Ok(book);
});

// Manual create.
app.MapPost("/catalog/books", async (CatalogDbContext db, BookCreate req) =>
{
    var validation = ValidateBook(req);
    if (validation is not null) return validation;

    var book = MapToBook(
        req.Title,
        req.Author,
        req.Category,
        req.Description,
        req.Publisher,
        req.Price,
        req.PublishMonth,
        req.Year,
        req.Isbn
    );

    db.Books.Add(book);
    await db.SaveChangesAsync();

    return Results.Created($"/catalog/books/{book.Id}", book);
}).RequireAuthorization("AdminOnly");

// Update.
app.MapPut("/catalog/books/{id:int}", async (CatalogDbContext db, int id, BookCreate req) =>
{
    var validation = ValidateBook(req);
    if (validation is not null) return validation;

    var existing = await db.Books.FindAsync(id);
    if (existing is null) return Results.NotFound(new { error = "Book not found." });

    var mapped = MapToBook(
        req.Title,
        req.Author,
        req.Category,
        req.Description,
        req.Publisher,
        req.Price,
        req.PublishMonth,
        req.Year,
        req.Isbn
    );

    existing.Title = mapped.Title;
    existing.Author = mapped.Author;
    existing.Category = mapped.Category;
    existing.Description = mapped.Description;
    existing.Publisher = mapped.Publisher;
    existing.Price = mapped.Price;
    existing.PublishMonth = mapped.PublishMonth;
    existing.Year = mapped.Year;
    existing.Isbn = mapped.Isbn;

    await db.SaveChangesAsync();
    return Results.Ok(existing);
}).RequireAuthorization("AdminOnly");

// Delete.
app.MapDelete("/catalog/books/{id:int}", async (CatalogDbContext db, int id) =>
{
    var book = await db.Books.FindAsync(id);
    if (book is null) return Results.NotFound(new { error = "Book not found." });

    db.Books.Remove(book);
    await db.SaveChangesAsync();
    return Results.Ok(new { ok = true });
}).RequireAuthorization("AdminOnly");

// CSV import.
app.MapPost("/catalog/books/import", async (HttpRequest request, CatalogDbContext db) =>
{
    if (!request.HasFormContentType)
        return Results.BadRequest(new { error = "Request must be multipart/form-data." });

    var form = await request.ReadFormAsync();
    var file = form.Files["file"];

    if (file is null || file.Length == 0)
        return Results.BadRequest(new { error = "CSV file is required." });

    if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
        return Results.BadRequest(new { error = "Only CSV files are allowed." });

    using var stream = file.OpenReadStream();
    using var reader = new StreamReader(stream);
    using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
    {
        HeaderValidated = null,
        MissingFieldFound = null,
        BadDataFound = null,
        TrimOptions = TrimOptions.Trim
    });

    csv.Context.RegisterClassMap<BookImportRowMap>();

    List<BookImportRow> rows;
    try
    {
        rows = csv.GetRecords<BookImportRow>().ToList();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = "Failed to parse CSV.", details = ex.Message });
    }

    var inserted = 0;
    var skipped = 0;
    var errors = new List<string>();
    var pending = new List<Book>();

    foreach (var row in rows)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(row.Title) ||
                string.IsNullOrWhiteSpace(row.Authors) ||
                string.IsNullOrWhiteSpace(row.Category))
            {
                skipped++;
                continue;
            }

            var mapped = MapToBook(
                row.Title,
                row.Authors,
                row.Category,
                row.Description,
                row.Publisher,
                row.PriceStartingWith,
                row.PublishDateMonth,
                row.PublishDateYear ?? 0
            );

            var exists = await db.Books.AnyAsync(b =>
                b.Title == mapped.Title &&
                b.Author == mapped.Author &&
                b.Publisher == mapped.Publisher &&
                b.Year == mapped.Year);

            if (exists)
            {
                skipped++;
                continue;
            }

            pending.Add(mapped);

            if (pending.Count >= 500)
            {
                db.Books.AddRange(pending);
                await db.SaveChangesAsync();
                inserted += pending.Count;
                pending.Clear();
            }
        }
        catch (Exception ex)
        {
            skipped++;
            if (errors.Count < 20) errors.Add(ex.Message);
        }
    }

    if (pending.Count > 0)
    {
        db.Books.AddRange(pending);
        await db.SaveChangesAsync();
        inserted += pending.Count;
    }

    return Results.Ok(new
    {
        inserted,
        skipped,
        errorCount = errors.Count,
        errors
    });
}).RequireAuthorization("AdminOnly");

app.Run(); // Start app.