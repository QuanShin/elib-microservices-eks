using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;

using AuthService.Data;
using AuthService.Models;

using Microsoft.AspNetCore.StaticFiles;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Keep original JWT claim names ("sub", "email", "role") stable
JwtSecurityTokenHandler.DefaultMapInboundClaims = false;

// ---- Database config ----
string dbHost = builder.Configuration["Database:Host"]!;
string dbPort = builder.Configuration["Database:Port"] ?? "3306";
string dbName = builder.Configuration["Database:Name"]!;
string dbUser = builder.Configuration["Database:User"]!;
string dbPass = builder.Configuration["Database:Password"]!;

string connStr = $"Server={dbHost};Port={dbPort};Database={dbName};User={dbUser};Password={dbPass};SslMode=Preferred;";

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseMySql(connStr, ServerVersion.AutoDetect(connStr)));

// ---- JWT / RSA config ----
string issuer = builder.Configuration["Jwt:Issuer"] ?? "elib-auth";
string audience = builder.Configuration["Jwt:Audience"] ?? "elib-web";
int accessMinutes = int.TryParse(builder.Configuration["Jwt:AccessTokenMinutes"], out var am) ? am : 15;
int refreshDays = int.TryParse(builder.Configuration["Jwt:RefreshTokenDays"], out var rd) ? rd : 14;
string kid = builder.Configuration["Jwt:Kid"] ?? "kid1";

string privPath = builder.Configuration["Keys:PrivateKeyPath"]!;
string pubPath = builder.Configuration["Keys:PublicKeyPath"]!;

string privatePem = File.ReadAllText(privPath);
string publicPem = File.ReadAllText(pubPath);

RSA rsaPrivate = RSA.Create();
rsaPrivate.ImportFromPem(privatePem);

RSA rsaPublic = RSA.Create();
rsaPublic.ImportFromPem(publicPem);

var signingKey = new RsaSecurityKey(rsaPrivate) { KeyId = kid };
var verifyKey = new RsaSecurityKey(rsaPublic) { KeyId = kid };

// ---- Auth middleware ----
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

        // Useful logs for debugging
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

// Serve frontend (wwwroot)
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

app.MapGet("/health", () => Results.Ok(new { ok = true }));

// JWKS endpoint for other services to verify JWT signature
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

    // Issue JWT (RS256)
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

    // Log issuance (good for assignment evaluation)
    var expUnix = new DateTimeOffset(exp).ToUnixTimeSeconds();
    Console.WriteLine($"[TOKEN ISSUED] email={user.Email}, sub={user.Id}, kid={kid}, exp(utc)={exp:o}, exp(unix)={expUnix}");

    // Refresh token stored in DB hashed
    string refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    string refreshHash = HashToken(refreshToken);

    db.RefreshTokens.Add(new RefreshToken
    {
        UserId = user.Id,
        TokenHash = refreshHash,
        ExpiresAtUtc = DateTime.UtcNow.AddDays(refreshDays)
    });
    await db.SaveChangesAsync();

    // CSRF token
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


// ======= DEBUG endpoints for assignment demo (remove later) =======

// Decode token payload to show exp/claims for evaluation (no signature verification here)
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


// ===== Helpers =====
static string HashToken(string token)
{
    using var sha = SHA256.Create();
    var bytes = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(token));
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

// ===== Requests =====
record RegisterRequest(string Email, string Password, string? Role);
record LoginRequest(string Email, string Password);
record DecodeRequest(string AccessToken);