using System.IdentityModel.Tokens.Jwt; // JWT claim names.
using System.Security.Claims; // Claims helpers.
using BorrowService.Data; // Borrow DbContext.
using BorrowService.Models; // Loan model.
using Microsoft.AspNetCore.Authentication.JwtBearer; // JWT auth.
using Microsoft.EntityFrameworkCore; // EF Core.
using Microsoft.IdentityModel.Tokens; // Token validation + JsonWebKeySet.

var builder = WebApplication.CreateBuilder(args); // Create builder.

builder.Configuration.AddJsonFile("appsettings.json", optional: true); // Base config.
builder.Configuration.AddEnvironmentVariables(); // Env overrides.

string GetRequired(string key)
{
    var value = builder.Configuration[key];
    if (string.IsNullOrWhiteSpace(value))
        throw new InvalidOperationException($"Missing configuration: {key}");
    return value;
}

string GetConnectionString()
{
    var direct = builder.Configuration["ConnectionStrings:Default"];
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

async Task<ICollection<SecurityKey>> LoadSigningKeysAsync(string jwksUrl)
{
    using var http = new HttpClient();
    var jwksJson = await http.GetStringAsync(jwksUrl);
    var jwks = new JsonWebKeySet(jwksJson);
    return jwks.GetSigningKeys();
}

var connStr = GetConnectionString();
var issuer = GetRequired("Jwt:Issuer");
var audience = GetRequired("Jwt:Audience");
var jwksUrl = GetRequired("Jwt:JwksUrl");
var catalogBaseUrl = builder.Configuration["Services:CatalogBaseUrl"] ?? "http://localhost:5001";
var signingKeys = await LoadSigningKeysAsync(jwksUrl);

builder.Services.AddDbContext<BorrowDbContext>(options =>
    options.UseMySql(
        connStr,
        new MySqlServerVersion(new Version(8, 4, 7)),
        mySqlOptions => mySqlOptions.EnableRetryOnFailure()
    ));

builder.Services.AddHttpClient("catalog", client =>
{
    client.BaseAddress = new Uri(catalogBaseUrl);
    client.Timeout = TimeSpan.FromSeconds(5);
});

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false; // Keep JWT claim names exactly as "sub", "email", "role".
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
            ClockSkew = TimeSpan.FromSeconds(30),

            NameClaimType = "sub",   // Treat "sub" as identity name.
            RoleClaimType = "role"   // Treat "role" as the role claim.
        };
    });    
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireClaim("role", "ADMIN"));
});

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

var app = builder.Build();

app.UseCors("Default");
app.UseAuthentication();
app.UseAuthorization();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BorrowDbContext>();
    await db.Database.MigrateAsync();
}

static int? TryGetUserId(ClaimsPrincipal user)
{
    var sub = user.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? user.FindFirstValue("sub");
    return int.TryParse(sub, out var id) ? id : null;
}

app.MapGet("/borrow/health", () => Results.Ok(new { ok = true }));

app.MapGet("/borrow/my-loans", async (BorrowDbContext db, ClaimsPrincipal user) =>
{
    var userId = TryGetUserId(user);
    if (userId is null) return Results.Unauthorized();

    var loans = await db.Loans
        .Where(x => x.UserId == userId)
        .OrderByDescending(x => x.BorrowedAtUtc)
        .ToListAsync();

    return Results.Ok(loans);
}).RequireAuthorization();

app.MapPost("/borrow/checkout/{bookId:int}", async (
    BorrowDbContext db,
    IHttpClientFactory httpClientFactory,
    ClaimsPrincipal user,
    int bookId) =>
{
    var userId = TryGetUserId(user);
    if (userId is null) return Results.Unauthorized();

    var catalog = httpClientFactory.CreateClient("catalog");
    var bookResponse = await catalog.GetAsync($"/catalog/books/{bookId}");
    if (!bookResponse.IsSuccessStatusCode)
        return Results.NotFound(new { error = "Book not found." });

    var activeCount = await db.Loans.CountAsync(x => x.UserId == userId && x.ReturnedAtUtc == null);
    if (activeCount >= 3)
        return Results.BadRequest(new { error = "Loan limit reached." });

    var alreadyBorrowed = await db.Loans.AnyAsync(x =>
        x.UserId == userId &&
        x.BookId == bookId &&
        x.ReturnedAtUtc == null);

    if (alreadyBorrowed)
        return Results.BadRequest(new { error = "Book already borrowed." });

    var loan = new Loan
    {
        UserId = userId.Value,
        BookId = bookId,
        BorrowedAtUtc = DateTime.UtcNow,
        DueAtUtc = DateTime.UtcNow.AddDays(14)
    };

    db.Loans.Add(loan);
    await db.SaveChangesAsync();

    return Results.Ok(new
    {
        loan.Id,
        loan.BookId,
        loan.DueAtUtc
    });
}).RequireAuthorization();

app.MapPost("/borrow/return/{loanId:int}", async (BorrowDbContext db, ClaimsPrincipal user, int loanId) =>
{
    var userId = TryGetUserId(user);
    if (userId is null) return Results.Unauthorized();

    var loan = await db.Loans.FirstOrDefaultAsync(x => x.Id == loanId && x.UserId == userId);
    if (loan is null) return Results.NotFound(new { error = "Loan not found." });
    if (loan.ReturnedAtUtc is not null) return Results.BadRequest(new { error = "Loan already returned." });

    loan.ReturnedAtUtc = DateTime.UtcNow;
    await db.SaveChangesAsync();

    return Results.Ok(new { ok = true });
}).RequireAuthorization();

app.MapGet("/borrow/admin/summary", async (BorrowDbContext db) =>
{
    var total = await db.Loans.CountAsync();
    var active = await db.Loans.CountAsync(x => x.ReturnedAtUtc == null);
    var returned = await db.Loans.CountAsync(x => x.ReturnedAtUtc != null);

    return Results.Ok(new { total, active, returned });
}).RequireAuthorization("AdminOnly");

app.Run();