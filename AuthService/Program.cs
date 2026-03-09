using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

using AuthService.Data;
using AuthService.Models;

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Keep original JWT claim names stable: "sub", "email", "role"
JwtSecurityTokenHandler.DefaultMapInboundClaims = false;

// -----------------------------
// Database config
// Prefer ConnectionStrings:Default from env / secret source
// -----------------------------
string connStr = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Missing ConnectionStrings:Default");

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseMySql(connStr, ServerVersion.AutoDetect(connStr)));

// -----------------------------
// JWT / RSA config
// -----------------------------
string issuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("Missing Jwt:Issuer");

string audience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("Missing Jwt:Audience");

int accessMinutes = int.TryParse(builder.Configuration["Jwt:AccessTokenMinutes"], out var am) ? am : 15;
int refreshDays = int.TryParse(builder.Configuration["Jwt:RefreshTokenDays"], out var rd) ? rd : 14;
string kid = builder.Configuration["Jwt:Kid"] ?? "kid1";

// Support either mounted file paths OR PEM text from environment
string? privatePem = builder.Configuration["Keys:PrivateKeyPem"];
string? publicPem = builder.Configuration["Keys:PublicKeyPem"];

string? privPath = builder.Configuration["Keys:PrivateKeyPath"];
string? pubPath = builder.Configuration["Keys:PublicKeyPath"];

if (string.IsNullOrWhiteSpace(privatePem))
{
    if (string.IsNullOrWhiteSpace(privPath))
        throw new InvalidOperationException("Missing Keys:PrivateKeyPem or Keys:PrivateKeyPath");
    privatePem = File.ReadAllText(privPath);
}

if (string.IsNullOrWhiteSpace(publicPem))
{
    if (string.IsNullOrWhiteSpace(pubPath))
        throw new InvalidOperationException("Missing Keys:PublicKeyPem or Keys:PublicKeyPath");
    publicPem = File.ReadAllText(pubPath);
}

RSA rsaPrivate = RSA.Create();
rsaPrivate.ImportFromPem(privatePem);

RSA rsaPublic = RSA.Create();
rsaPublic.ImportFromPem(publicPem);

var signingKey = new RsaSecurityKey(rsaPrivate) { KeyId = kid };
var verifyKey = new RsaSecurityKey(rsaPublic) { KeyId = kid };

// -----------------------------
// Authentication
// -----------------------------
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = verifyKey,
            ClockSkew = TimeSpan.FromSeconds(10)
        };

        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = ctx =>
            {
                Console.WriteLine($"[AUTH FAILED] {ctx.Exception.GetType().Name}: {ctx.Exception.Message}");
                return Task.CompletedTask;
            },
            OnTokenValidated = ctx =>
            {
                var sub = ctx.Principal?.FindFirstValue("sub");
                Console.WriteLine($"[TOKEN VALID] sub={sub}, kid={kid}");
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();
var isDev = app.Environment.IsDevelopment();

// Optional static hosting support
var provider = new FileExtensionContentTypeProvider();
provider.Mappings[".js"] = "text/javascript";
provider.Mappings[".mjs"] = "text/javascript";

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions { ContentTypeProvider = provider });

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { ok = true }));

// JWKS endpoint
app.MapGet("/.well-known/jwks.json", () =>
{
    var rsa = rsaPublic.ExportParameters(false);
    string n = Base64UrlEncoder.Encode(rsa.Modulus);
    string e = Base64UrlEncoder.Encode(rsa.Exponent);

    return Results.Json(new
    {
        keys = new[] { new { kty = "RSA", use = "sig", alg = "RS256", kid, n, e } }
    });
});

// Register
app.MapPost("/register", async (AppDbContext db, RegisterRequest req) =>
{
    var email = req.Email.Trim().ToLowerInvariant();
    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(req.Password))
        return Results.BadRequest(new { error = "Email and password required." });

    if (req.Password.Length < 6)
        return Results.BadRequest(new { error = "Password must be at least 6 characters." });

    var exists = await db.Users.AnyAsync(u => u.Email == email);
    if (exists) return Results.Conflict(new { error = "Email already exists." });

    var user = new User
    {
        Email = email,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
        Role = string.IsNullOrWhiteSpace(req.Role) ? "MEMBER" : req.Role.Trim().ToUpperInvariant()
    };

    db.Users.Add(user);
    await db.SaveChangesAsync();

    return Results.Created($"/users/{user.Id}", new { id = user.Id, email = user.Email, role = user.Role });
});

// Login
app.MapPost("/login", async (AppDbContext db, HttpResponse response, LoginRequest req) =>
{
    var email = req.Email.Trim().ToLowerInvariant();
    var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);

    if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        return Results.Json(new { error = "Invalid credentials." }, statusCode: StatusCodes.Status401Unauthorized);

    var creds = new SigningCredentials(signingKey, SecurityAlgorithms.RsaSha256);

    var claims = new List<Claim>
    {
        new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new(JwtRegisteredClaimNames.Email, user.Email),
        new("role", user.Role)
    };

    var exp = DateTime.UtcNow.AddMinutes(accessMinutes);
    var jwt = new JwtSecurityToken(
        issuer: issuer,
        audience: audience,
        claims: claims,
        expires: exp,
        signingCredentials: creds
    );

    string accessToken = new JwtSecurityTokenHandler().WriteToken(jwt);

    var expUnix = new DateTimeOffset(exp).ToUnixTimeSeconds();
    Console.WriteLine($"[TOKEN ISSUED] email={user.Email}, sub={user.Id}, kid={kid}, exp(utc)={exp:o}, exp(unix)={expUnix}");

    string refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    string refreshHash = HashToken(refreshToken);

    db.RefreshTokens.Add(new RefreshToken
    {
        UserId = user.Id,
        TokenHash = refreshHash,
        ExpiresAtUtc = DateTime.UtcNow.AddDays(refreshDays)
    });
    await db.SaveChangesAsync();

    string csrfToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
    SetRefreshCookie(response, refreshToken, refreshDays, isDev);
    SetCsrfCookie(response, csrfToken, refreshDays, isDev);

    return Results.Ok(new { accessToken, expiresIn = accessMinutes * 60, csrfToken });
});

// Refresh
app.MapPost("/refresh", async (AppDbContext db, HttpRequest request) =>
{
    if (!ValidateCsrf(request))
        return Results.Json(new { error = "CSRF validation failed." }, statusCode: StatusCodes.Status403Forbidden);

    if (!request.Cookies.TryGetValue("refresh_token", out var refreshToken) || string.IsNullOrWhiteSpace(refreshToken))
        return Results.Json(new { error = "Missing refresh token." }, statusCode: StatusCodes.Status401Unauthorized);

    string hash = HashToken(refreshToken);

    var rt = await db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == hash);
    if (rt is null)
        return Results.Json(new { error = "Invalid refresh token." }, statusCode: StatusCodes.Status401Unauthorized);

    if (rt.RevokedAtUtc is not null)
        return Results.Json(new { error = "Refresh token revoked." }, statusCode: StatusCodes.Status401Unauthorized);

    if (rt.ExpiresAtUtc < DateTime.UtcNow)
        return Results.Json(new { error = "Refresh token expired." }, statusCode: StatusCodes.Status401Unauthorized);

    var user = await db.Users.FindAsync(rt.UserId);
    if (user is null)
        return Results.Json(new { error = "Invalid refresh token." }, statusCode: StatusCodes.Status401Unauthorized);

    var creds = new SigningCredentials(signingKey, SecurityAlgorithms.RsaSha256);

    var claims = new List<Claim>
    {
        new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
        new(JwtRegisteredClaimNames.Email, user.Email),
        new("role", user.Role)
    };

    var exp = DateTime.UtcNow.AddMinutes(accessMinutes);
    var jwt = new JwtSecurityToken(
        issuer: issuer,
        audience: audience,
        claims: claims,
        expires: exp,
        signingCredentials: creds
    );

    string accessToken = new JwtSecurityTokenHandler().WriteToken(jwt);
    Console.WriteLine($"[TOKEN REFRESHED] sub={user.Id}, kid={kid}, exp(utc)={exp:o}");

    return Results.Ok(new { accessToken, expiresIn = accessMinutes * 60 });
});

// Logout
app.MapPost("/logout", async (AppDbContext db, HttpRequest request, HttpResponse response) =>
{
    if (!ValidateCsrf(request))
        return Results.Json(new { error = "CSRF validation failed." }, statusCode: StatusCodes.Status403Forbidden);

    if (request.Cookies.TryGetValue("refresh_token", out var refreshToken) && !string.IsNullOrWhiteSpace(refreshToken))
    {
        string hash = HashToken(refreshToken);
        var rt = await db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == hash);

        if (rt is not null && rt.RevokedAtUtc is null)
        {
            rt.RevokedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync();
            Console.WriteLine("[LOGOUT] Refresh token revoked.");
        }
    }

    response.Cookies.Delete("refresh_token");
    response.Cookies.Delete("csrf_token");

    return Results.Ok(new { message = "Logged out." });
});

// Protected endpoint
app.MapGet("/me", (ClaimsPrincipal user) =>
{
    var sub = user.FindFirstValue("sub");
    var email = user.FindFirstValue("email");
    var role = user.FindFirstValue("role");
    return Results.Ok(new { sub, email, role });
}).RequireAuthorization();

// Debug decode
app.MapPost("/debug/decode", (DecodeRequest req) =>
{
    try
    {
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(req.AccessToken);
        return Results.Ok(new
        {
            header = token.Header,
            claims = token.Claims.Select(c => new { c.Type, c.Value }),
            validToUtc = token.ValidTo,
        });
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
});

app.Run();

static string HashToken(string token)
{
    using var sha = SHA256.Create();
    var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(token));
    return Convert.ToHexString(bytes).ToLowerInvariant();
}

static void SetRefreshCookie(HttpResponse response, string refreshToken, int refreshDays, bool isDev)
{
    response.Cookies.Append("refresh_token", refreshToken, new CookieOptions
    {
        HttpOnly = true,
        Secure = !isDev,
        SameSite = SameSiteMode.Strict,
        Path = "/",
        Expires = DateTimeOffset.UtcNow.AddDays(refreshDays)
    });
}

static void SetCsrfCookie(HttpResponse response, string csrf, int refreshDays, bool isDev)
{
    response.Cookies.Append("csrf_token", csrf, new CookieOptions
    {
        HttpOnly = false,
        Secure = !isDev,
        SameSite = SameSiteMode.Strict,
        Path = "/",
        Expires = DateTimeOffset.UtcNow.AddDays(refreshDays)
    });
}

static bool ValidateCsrf(HttpRequest request)
{
    if (!request.Cookies.TryGetValue("csrf_token", out var cookieCsrf)) return false;
    if (!request.Headers.TryGetValue("X-CSRF", out var headerCsrf)) return false;
    return string.Equals(cookieCsrf, headerCsrf.ToString(), StringComparison.Ordinal);
}

record RegisterRequest(string Email, string Password, string? Role);
record LoginRequest(string Email, string Password);
record DecodeRequest(string AccessToken);