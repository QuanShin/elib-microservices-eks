using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using AuthService.Data;
using AuthService.DTOs;
using AuthService.Models;
using BCrypt.Net;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.CookiePolicy;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddJsonFile("appsettings.json", optional: true);
builder.Configuration.AddEnvironmentVariables();

string GetRequired(string key)
{
    var value = builder.Configuration[key];
    if (string.IsNullOrWhiteSpace(value))
        throw new InvalidOperationException($"Missing configuration: {key}");
    return value;
}

string ReadSecretFileOrConfig(string fileKey, string configKey)
{
    var filePath = builder.Configuration[fileKey];
    if (!string.IsNullOrWhiteSpace(filePath) && File.Exists(filePath))
        return File.ReadAllText(filePath).Trim();

    var value = builder.Configuration[configKey];
    if (!string.IsNullOrWhiteSpace(value))
        return value;

    throw new InvalidOperationException($"Missing secret for {configKey}");
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

var connStr = GetConnectionString();
var issuer = GetRequired("Jwt:Issuer");
var audience = GetRequired("Jwt:Audience");
var kid = GetRequired("Jwt:Kid");
var accessMinutes = int.Parse(GetRequired("Jwt:AccessTokenMinutes"));
var refreshDays = int.Parse(GetRequired("Jwt:RefreshTokenDays"));
var isDev = builder.Environment.IsDevelopment();

var privateKeyPem = ReadSecretFileOrConfig("Keys:PrivateKeyPath", "Jwt:PrivateKeyPem");
var publicKeyPem = ReadSecretFileOrConfig("Keys:PublicKeyPath", "Jwt:PublicKeyPem");

var rsaPrivate = RSA.Create();
rsaPrivate.ImportFromPem(privateKeyPem);

var rsaPublic = RSA.Create();
rsaPublic.ImportFromPem(publicKeyPem);

var signingKey = new RsaSecurityKey(rsaPrivate) { KeyId = kid };
var validationKey = new RsaSecurityKey(rsaPublic) { KeyId = kid };

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendCors", policy =>
    {
        policy
            .WithOrigins(
                "https://app.elibapp.io.vn",
                "http://localhost:5173"
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(
        connStr,
        new MySqlServerVersion(new Version(8, 4, 7)),
        mySqlOptions => mySqlOptions.EnableRetryOnFailure()
    ));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = validationKey,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireClaim("role", "ADMIN"));
});

var app = builder.Build();

app.Use(async (context, next) =>
{
    if (HttpMethods.IsOptions(context.Request.Method))
    {
        var origin = context.Request.Headers.Origin.ToString();

        if (origin == "https://app.elibapp.io.vn" || origin == "http://localhost:5173")
        {
            context.Response.Headers["Access-Control-Allow-Origin"] = origin;
            context.Response.Headers["Vary"] = "Origin";
            context.Response.Headers["Access-Control-Allow-Credentials"] = "true";
            context.Response.Headers["Access-Control-Allow-Headers"] = "content-type, authorization, x-csrf, x-csrf-token";
            context.Response.Headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
            context.Response.StatusCode = StatusCodes.Status204NoContent;
            return;
        }
    }

    await next();
});

app.UseCookiePolicy(new CookiePolicyOptions
{
    MinimumSameSitePolicy = SameSiteMode.Lax
});

app.UseCors("FrontendCors");
app.UseAuthentication();
app.UseAuthorization();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

static string HashToken(string raw)
{
    var bytes = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(raw));
    return Convert.ToHexString(bytes);
}

static string GenerateRefreshToken() =>
    Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));

static string? GetClaim(ClaimsPrincipal user, params string[] names)
{
    foreach (var name in names)
    {
        var value = user.FindFirstValue(name);
        if (!string.IsNullOrWhiteSpace(value))
            return value;
    }
    return null;
}

string IssueAccessToken(User user)
{
    var creds = new SigningCredentials(signingKey, SecurityAlgorithms.RsaSha256);

    var claims = new List<Claim>
    {
        new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new(JwtRegisteredClaimNames.Email, user.Email),
        new("role", user.Role)
    };

    var jwt = new JwtSecurityToken(
        issuer: issuer,
        audience: audience,
        claims: claims,
        expires: DateTime.UtcNow.AddMinutes(accessMinutes),
        signingCredentials: creds
    );

    return new JwtSecurityTokenHandler().WriteToken(jwt);
}

void SetRefreshCookie(HttpResponse response, string refreshToken)
{
    response.Cookies.Append("refresh_token", refreshToken, new CookieOptions
    {
        HttpOnly = true,
        Secure = !isDev,
        SameSite = SameSiteMode.Lax,
        Expires = DateTimeOffset.UtcNow.AddDays(refreshDays)
    });
}

void SetCsrfCookie(HttpResponse response, string csrfToken)
{
    response.Cookies.Append("csrf_token", csrfToken, new CookieOptions
    {
        HttpOnly = false,
        Secure = !isDev,
        SameSite = SameSiteMode.Lax,
        Expires = DateTimeOffset.UtcNow.AddDays(refreshDays)
    });
}

bool ValidateCsrf(HttpRequest request)
{
    if (!request.Cookies.TryGetValue("csrf_token", out var cookieValue))
        return false;

    if (request.Headers.TryGetValue("X-CSRF-Token", out var headerValue))
        return string.Equals(cookieValue, headerValue.ToString(), StringComparison.Ordinal);

    if (request.Headers.TryGetValue("X-CSRF", out var legacyHeaderValue))
        return string.Equals(cookieValue, legacyHeaderValue.ToString(), StringComparison.Ordinal);

    return false;
}

app.MapGet("/health", () => Results.Ok(new { ok = true }));

app.MapPost("/register", async (AppDbContext db, RegisterRequest req) =>
{
    var email = (req.Email ?? "").Trim().ToLowerInvariant();
    var password = req.Password ?? "";

    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        return Results.BadRequest(new { error = "Email and password are required." });

    try
    {
        _ = new System.Net.Mail.MailAddress(email);
    }
    catch
    {
        return Results.BadRequest(new { error = "Invalid email format." });
    }

    if (password.Length < 8)
        return Results.BadRequest(new { error = "Password must be at least 8 characters." });

    var exists = await db.Users.AnyAsync(u => u.Email == email);
    if (exists)
        return Results.Conflict(new { error = "Email already exists." });

    var user = new User
    {
        Email = email,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
        Role = "MEMBER",
        CreatedAtUtc = DateTime.UtcNow
    };

    db.Users.Add(user);
    await db.SaveChangesAsync();

    return Results.Created($"/users/{user.Id}", new
    {
        user.Id,
        user.Email,
        user.Role
    });
});

app.MapPost("/login", async (AppDbContext db, LoginRequest req, HttpResponse response) =>
{
    var email = (req.Email ?? "").Trim().ToLowerInvariant();
    var password = req.Password ?? "";

    var user = await db.Users.FirstOrDefaultAsync(x => x.Email == email);
    if (user is null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
        return Results.Unauthorized();

    var accessToken = IssueAccessToken(user);

    var refreshRaw = GenerateRefreshToken();
    db.RefreshTokens.Add(new RefreshToken
    {
        UserId = user.Id,
        TokenHash = HashToken(refreshRaw),
        ExpiresAtUtc = DateTime.UtcNow.AddDays(refreshDays)
    });

    await db.SaveChangesAsync();
    SetRefreshCookie(response, refreshRaw);

    var csrfToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
    SetCsrfCookie(response, csrfToken);

    return Results.Ok(new
    {
        accessToken,
        csrfToken,
        user = new
        {
            user.Id,
            user.Email,
            user.Role
        }
    });
});

app.MapPost("/refresh", async (AppDbContext db, HttpRequest request, HttpResponse response) =>
{
    if (!ValidateCsrf(request))
        return Results.Json(new { error = "CSRF validation failed." }, statusCode: StatusCodes.Status403Forbidden);

    if (!request.Cookies.TryGetValue("refresh_token", out var refreshRaw) || string.IsNullOrWhiteSpace(refreshRaw))
        return Results.Json(new { error = "Missing refresh token." }, statusCode: StatusCodes.Status401Unauthorized);

    var tokenHash = HashToken(refreshRaw);
    var rt = await db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == tokenHash);

    if (rt is null || rt.RevokedAtUtc is not null || rt.ExpiresAtUtc < DateTime.UtcNow)
        return Results.Json(new { error = "Invalid refresh token." }, statusCode: StatusCodes.Status401Unauthorized);

    var user = await db.Users.FindAsync(rt.UserId);
    if (user is null)
        return Results.Json(new { error = "Invalid refresh token." }, statusCode: StatusCodes.Status401Unauthorized);

    rt.RevokedAtUtc = DateTime.UtcNow;

    var newRefreshRaw = GenerateRefreshToken();
    db.RefreshTokens.Add(new RefreshToken
    {
        UserId = user.Id,
        TokenHash = HashToken(newRefreshRaw),
        ExpiresAtUtc = DateTime.UtcNow.AddDays(refreshDays)
    });

    await db.SaveChangesAsync();
    SetRefreshCookie(response, newRefreshRaw);

    var newCsrfToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
    SetCsrfCookie(response, newCsrfToken);

    return Results.Ok(new
    {
        accessToken = IssueAccessToken(user),
        csrfToken = newCsrfToken
    });
});

app.MapPost("/logout", async (AppDbContext db, HttpRequest request, HttpResponse response) =>
{
    if (!ValidateCsrf(request))
        return Results.Json(new { error = "CSRF validation failed." }, statusCode: StatusCodes.Status403Forbidden);

    if (request.Cookies.TryGetValue("refresh_token", out var refreshRaw) && !string.IsNullOrWhiteSpace(refreshRaw))
    {
        var tokenHash = HashToken(refreshRaw);
        var rt = await db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == tokenHash);
        if (rt is not null && rt.RevokedAtUtc is null)
        {
            rt.RevokedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }
    }

    response.Cookies.Delete("refresh_token");
    response.Cookies.Delete("csrf_token");
    return Results.Ok(new { ok = true });
});

app.MapGet("/me", (ClaimsPrincipal user) =>
{
    var sub = GetClaim(user, JwtRegisteredClaimNames.Sub, "sub", ClaimTypes.NameIdentifier);
    var email = GetClaim(user, JwtRegisteredClaimNames.Email, "email", ClaimTypes.Email);
    var role = GetClaim(user, "role", ClaimTypes.Role);

    return Results.Ok(new { sub, email, role });
}).RequireAuthorization();

app.MapGet("/.well-known/jwks.json", () =>
{
    var parameters = rsaPublic.ExportParameters(false);
    var e = Base64UrlEncoder.Encode(parameters.Exponent!);
    var n = Base64UrlEncoder.Encode(parameters.Modulus!);

    return Results.Json(new
    {
        keys = new[]
        {
            new
            {
                kty = "RSA",
                use = "sig",
                kid,
                alg = "RS256",
                n,
                e
            }
        }
    });
});

app.Run();