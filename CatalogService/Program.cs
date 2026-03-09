using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

using CatalogService.Data;
using CatalogService.Models;

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

JwtSecurityTokenHandler.DefaultMapInboundClaims = false;

var builder = WebApplication.CreateBuilder(args);

// ---- DB ----
string dbHost = builder.Configuration["Database:Host"]!;
string dbPort = builder.Configuration["Database:Port"] ?? "3306";
string dbName = builder.Configuration["Database:Name"]!;
string dbUser = builder.Configuration["Database:User"]!;
string dbPass = builder.Configuration["Database:Password"]!;

string connStr = $"Server={dbHost};Port={dbPort};Database={dbName};User={dbUser};Password={dbPass};SslMode=Preferred;";

builder.Services.AddDbContext<CatalogDbContext>(opt =>
    opt.UseMySql(connStr, ServerVersion.AutoDetect(connStr)));

// ---- JWT (enterprise: JwtBearer + JWKS) ----
string issuer = builder.Configuration["Jwt:Issuer"] ?? "elib-auth";
string audience = builder.Configuration["Jwt:Audience"] ?? "elib-web";
string jwksUrl = builder.Configuration["Jwt:JwksUrl"] ?? throw new Exception("Jwt:JwksUrl missing");

// This uses OpenIdConnectConfigurationRetriever, but we only supply JWKS URI
// so we manually set SigningKeys via ConfigurationManager and a custom retriever.
var httpDocRetriever = new HttpDocumentRetriever { RequireHttps = false }; // local dev uses http
var jwksManager = new ConfigurationManager<OpenIdConnectConfiguration>(
    metadataAddress: jwksUrl, // yes, we point to jwks.json directly
    configRetriever: new JwksOnlyRetriever(),
    docRetriever: httpDocRetriever)
{
    AutomaticRefreshInterval = TimeSpan.FromMinutes(10),
    RefreshInterval = TimeSpan.FromMinutes(1)
};

builder.Services.AddSingleton<IConfigurationManager<OpenIdConnectConfiguration>>(jwksManager);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = issuer,

            ValidateAudience = true,
            ValidAudience = audience,

            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero,

            ValidateIssuerSigningKey = true,
            // do NOT set IssuerSigningKey(s) here; we resolve from JWKS below
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                // Always extract the JWT cleanly (prevents "Bearer" decode issue)
                var auth = ctx.Request.Headers.Authorization.ToString();
                if (!string.IsNullOrWhiteSpace(auth))
                {
                    var parts = auth.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length >= 2) ctx.Token = parts[^1];
                }
                return Task.CompletedTask;
            },

            OnTokenValidated = ctx =>
            {
                // Optional logging
                var sub = ctx.Principal?.FindFirstValue("sub");
                var role = ctx.Principal?.FindFirstValue("role");
                Console.WriteLine($"[CATALOG TOKEN OK] sub={sub}, role={role}");
                return Task.CompletedTask;
            },

            OnAuthenticationFailed = ctx =>
            {
                Console.WriteLine("[CATALOG AUTH FAILED] " + ctx.Exception.GetType().Name + ": " + ctx.Exception.Message);
                return Task.CompletedTask;
            }
        };

        // The enterprise part: dynamically resolve signing keys from JWKS manager
        options.TokenValidationParameters.IssuerSigningKeyResolver =
            (token, securityToken, kid, validationParameters) =>
            {
                var cfg = jwksManager.GetConfigurationAsync(default).GetAwaiter().GetResult();

                // If we have a kid, prefer matching key; otherwise try all keys (rotation-safe)
                if (!string.IsNullOrWhiteSpace(kid))
                    return cfg.SigningKeys.Where(k => k.KeyId == kid).ToList();

                return cfg.SigningKeys;
            };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireAuthenticatedUser()
              .RequireClaim("role", "ADMIN"));
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseAuthentication();
app.UseAuthorization();

// ---- DB init / seed ----
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
    await db.Database.EnsureCreatedAsync();

    if (!await db.Books.AnyAsync())
    {
        db.Books.AddRange(
            new Book { Title = "Clean Code", Author = "Robert C. Martin", Category = "Software", Year = 2008, Isbn = "9780132350884" },
            new Book { Title = "Designing Data-Intensive Applications", Author = "Martin Kleppmann", Category = "Software", Year = 2017, Isbn = "9781449373320" },
            new Book { Title = "The Pragmatic Programmer", Author = "Andrew Hunt", Category = "Software", Year = 1999, Isbn = "9780201616224" }
        );
        await db.SaveChangesAsync();
    }
}

// ---- Debug ----
app.MapGet("/catalog/debug/whoami", (ClaimsPrincipal user) =>
{
    return Results.Ok(new
    {
        isAuthenticated = user?.Identity?.IsAuthenticated ?? false,
        sub = user.FindFirstValue("sub"),
        role = user.FindFirstValue("role"),
        email = user.FindFirstValue("email")
    });
}).RequireAuthorization();

// ---- Health ----
app.MapGet("/catalog/health", () => Results.Ok(new { ok = true }));

// ---- Public: list books ----
app.MapGet("/catalog/books", async (CatalogDbContext db, string? query, string? category) =>
{
    var q = db.Books.AsQueryable();

    if (!string.IsNullOrWhiteSpace(query))
    {
        var term = query.Trim();
        q = q.Where(b => b.Title.Contains(term) || b.Author.Contains(term));
    }

    if (!string.IsNullOrWhiteSpace(category))
    {
        var cat = category.Trim();
        q = q.Where(b => b.Category == cat);
    }

    var books = await q
        .OrderBy(b => b.Title)
        .Select(b => new { b.Id, b.Title, b.Author, b.Category, b.Year })
        .ToListAsync();

    return Results.Ok(books);
});

// ---- Public: details ----
app.MapGet("/catalog/books/{id:int}", async (CatalogDbContext db, int id) =>
{
    var book = await db.Books.FindAsync(id);
    if (book is null) return Results.NotFound(new { error = "Book not found." });
    return Results.Ok(book);
});

// ---- Admin: create ----
app.MapPost("/catalog/books", async (CatalogDbContext db, BookCreate req) =>
{
    var book = new Book
    {
        Title = req.Title.Trim(),
        Author = req.Author.Trim(),
        Category = req.Category.Trim(),
        Description = req.Description,
        Year = req.Year,
        Isbn = req.Isbn
    };

    db.Books.Add(book);
    await db.SaveChangesAsync();
    return Results.Created($"/catalog/books/{book.Id}", book);
}).RequireAuthorization("AdminOnly");

// ---- Admin: update ----
app.MapPut("/catalog/books/{id:int}", async (CatalogDbContext db, int id, BookCreate req) =>
{
    var book = await db.Books.FindAsync(id);
    if (book is null) return Results.NotFound(new { error = "Book not found." });

    book.Title = req.Title.Trim();
    book.Author = req.Author.Trim();
    book.Category = req.Category.Trim();
    book.Description = req.Description;
    book.Year = req.Year;
    book.Isbn = req.Isbn;

    await db.SaveChangesAsync();
    return Results.Ok(book);
}).RequireAuthorization("AdminOnly");

// ---- Admin: delete ----
app.MapDelete("/catalog/books/{id:int}", async (CatalogDbContext db, int id) =>
{
    var book = await db.Books.FindAsync(id);
    if (book is null) return Results.NotFound(new { error = "Book not found." });

    db.Books.Remove(book);
    await db.SaveChangesAsync();
    return Results.Ok(new { message = "Deleted." });
}).RequireAuthorization("AdminOnly");

app.Run();

record BookCreate(string Title, string Author, string Category, int Year, string? Description, string? Isbn);

// ===== JWKS retriever that reads jwks.json directly =====
sealed class JwksOnlyRetriever : IConfigurationRetriever<OpenIdConnectConfiguration>
{
    public async Task<OpenIdConnectConfiguration> GetConfigurationAsync(string address, IDocumentRetriever retriever, CancellationToken cancel)
    {
        // address is jwks.json
        var json = await retriever.GetDocumentAsync(address, cancel);

        var jwks = new JsonWebKeySet(json);
        var cfg = new OpenIdConnectConfiguration();

        foreach (var k in jwks.Keys)
        {
            cfg.SigningKeys.Add(k);
        }

        return cfg;
    }
}