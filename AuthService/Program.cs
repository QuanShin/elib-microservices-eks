using System.IdentityModel.Tokens.Jwt; // Used for creating JWT tokens.
using System.Security.Claims; // Used for claim handling.
using System.Security.Cryptography; // Used for RSA keys and secure token generation.
using AuthService.Data; // EF Core DbContext namespace.
using AuthService.DTOs; // DTO namespace.
using AuthService.Models; // User + RefreshToken models.
using BCrypt.Net; // Password hashing.
using Microsoft.AspNetCore.Authentication.JwtBearer; // JWT middleware.
using Microsoft.AspNetCore.CookiePolicy; // Cookie policy support.
using Microsoft.EntityFrameworkCore; // EF Core.
using Microsoft.IdentityModel.Tokens; // Token signing/validation.

var builder = WebApplication.CreateBuilder(args); // Create the ASP.NET builder.

// Load JSON config first.
builder.Configuration.AddJsonFile("appsettings.json", optional: true); // Base config.
// Then allow env vars to override.
builder.Configuration.AddEnvironmentVariables(); // Needed for Helm/Kubernetes.

// Helper: read required config or fail fast.
string GetRequired(string key)
{
    var value = builder.Configuration[key]; // Read config.
    if (string.IsNullOrWhiteSpace(value)) // If missing,
        throw new InvalidOperationException($"Missing configuration: {key}"); // stop clearly.
    return value; // Return value if found.
}

// Helper: support mounted file path OR direct config value.
string ReadSecretFileOrConfig(string fileKey, string configKey)
{
    var filePath = builder.Configuration[fileKey]; // Try file path first.
    if (!string.IsNullOrWhiteSpace(filePath) && File.Exists(filePath)) // If path exists,
        return File.ReadAllText(filePath).Trim(); // read file contents.

    var value = builder.Configuration[configKey]; // Try direct config value next.
    if (!string.IsNullOrWhiteSpace(value)) // If found,
        return value; // return it.

    throw new InvalidOperationException($"Missing secret for {configKey}"); // Otherwise fail clearly.
}

// Helper: build DB connection string from either full connection string or split Database config.
string GetConnectionString()
{
    var direct = builder.Configuration["ConnectionStrings:Default"]; // Prefer full connection string.
    if (!string.IsNullOrWhiteSpace(direct))
        return direct; // Use direct string if present.

    var host = builder.Configuration["Database:Host"]; // DB host.
    var port = builder.Configuration["Database:Port"]; // DB port.
    var name = builder.Configuration["Database:Name"]; // DB name.
    var user = builder.Configuration["Database:User"]; // DB user.
    var password = builder.Configuration["Database:Password"]; // DB password.

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

    return $"server={host};port={port};database={name};user={user};password={password}"; // Build MySQL connection string.
}

// Read auth config.
var connStr = GetConnectionString(); // DB connection string.
var issuer = GetRequired("Jwt:Issuer"); // JWT issuer.
var audience = GetRequired("Jwt:Audience"); // JWT audience.
var kid = GetRequired("Jwt:Kid"); // JWT key id.
var accessMinutes = int.Parse(GetRequired("Jwt:AccessTokenMinutes")); // Access token lifetime.
var refreshDays = int.Parse(GetRequired("Jwt:RefreshTokenDays")); // Refresh token lifetime.
var isDev = builder.Environment.IsDevelopment(); // Development flag.

// Support either file-based keys or inline PEM values.
var privateKeyPem = ReadSecretFileOrConfig("Keys:PrivateKeyPath", "Jwt:PrivateKeyPem"); // Private key.
var publicKeyPem = ReadSecretFileOrConfig("Keys:PublicKeyPath", "Jwt:PublicKeyPem"); // Public key.

// Build RSA keys.
var rsaPrivate = RSA.Create(); // Private RSA key.
rsaPrivate.ImportFromPem(privateKeyPem); // Import private PEM.

var rsaPublic = RSA.Create(); // Public RSA key.
rsaPublic.ImportFromPem(publicKeyPem); // Import public PEM.

// Create signing/validation keys.
var signingKey = new RsaSecurityKey(rsaPrivate) { KeyId = kid }; // Signing key.
var validationKey = new RsaSecurityKey(rsaPublic) { KeyId = kid }; // Validation key.

// Register DbContext.
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(
        connStr,
        new MySqlServerVersion(new Version(8, 4, 7)),
        mySqlOptions => mySqlOptions.EnableRetryOnFailure()
    ));

// Configure JWT auth.
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true, // Check issuer.
            ValidIssuer = issuer, // Expected issuer.
            ValidateAudience = true, // Check audience.
            ValidAudience = audience, // Expected audience.
            ValidateIssuerSigningKey = true, // Check signing key.
            IssuerSigningKey = validationKey, // Public key.
            ValidateLifetime = true, // Check expiry.
            ClockSkew = TimeSpan.FromSeconds(30) // Allow small drift.
        };
    });

// Configure authorization.
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireClaim("role", "ADMIN")); // Require ADMIN role.
});

// Configure CORS.
builder.Services.AddCors(options =>
{
    options.AddPolicy("Default", policy =>
    {
        policy
            .AllowAnyHeader() // Allow headers.
            .AllowAnyMethod() // Allow methods.
            .SetIsOriginAllowed(_ => true) // Allow dynamic origins.
            .AllowCredentials(); // Allow cookies.
    });
});

var app = builder.Build(); // Build app.

app.UseCors("Default"); // Enable CORS.
app.UseCookiePolicy(new CookiePolicyOptions
{
    MinimumSameSitePolicy = SameSiteMode.Lax // Safe default cookie policy.
});
app.UseAuthentication(); // Enable authentication.
app.UseAuthorization(); // Enable authorization.

// Auto-apply migrations on startup.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); // Resolve DbContext.
    await db.Database.MigrateAsync(); // Apply migrations.
}

// Hash refresh token before DB storage.
static string HashToken(string raw)
{
    var bytes = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(raw)); // SHA256 hash.
    return Convert.ToHexString(bytes); // Convert to string.
}

// Generate secure refresh token.
static string GenerateRefreshToken() =>
    Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)); // 48 random bytes.

// Safe claim lookup.
static string? GetClaim(ClaimsPrincipal user, params string[] names)
{
    foreach (var name in names) // Try claim names one by one.
    {
        var value = user.FindFirstValue(name); // Lookup claim.
        if (!string.IsNullOrWhiteSpace(value))
            return value; // Return first found claim.
    }
    return null; // Return null if not found.
}

// Centralized access token creation.
string IssueAccessToken(User user)
{
    var creds = new SigningCredentials(signingKey, SecurityAlgorithms.RsaSha256); // RSA SHA256 signing.

    var claims = new List<Claim>
    {
        new(JwtRegisteredClaimNames.Sub, user.Id.ToString()), // Subject = user id.
        new(JwtRegisteredClaimNames.Email, user.Email), // Email claim.
        new("role", user.Role) // App role claim.
    };

    var jwt = new JwtSecurityToken(
        issuer: issuer, // Issuer.
        audience: audience, // Audience.
        claims: claims, // Claims.
        expires: DateTime.UtcNow.AddMinutes(accessMinutes), // Expiry.
        signingCredentials: creds // Signing key.
    );

    return new JwtSecurityTokenHandler().WriteToken(jwt); // Serialize JWT.
}

// Set refresh cookie.
void SetRefreshCookie(HttpResponse response, string refreshToken)
{
    response.Cookies.Append("refresh_token", refreshToken, new CookieOptions
    {
        HttpOnly = true, // JS cannot read.
        Secure = !isDev, // HTTPS only outside dev.
        SameSite = SameSiteMode.Lax, // Good default.
        Expires = DateTimeOffset.UtcNow.AddDays(refreshDays) // Expiry.
    });
}

// Set CSRF cookie.
void SetCsrfCookie(HttpResponse response, string csrfToken)
{
    response.Cookies.Append("csrf_token", csrfToken, new CookieOptions
    {
        HttpOnly = false, // Frontend must read this.
        Secure = !isDev, // HTTPS only outside dev.
        SameSite = SameSiteMode.Lax, // Same-site protection.
        Expires = DateTimeOffset.UtcNow.AddDays(refreshDays) // Match refresh lifetime.
    });
}

// Validate CSRF token.
bool ValidateCsrf(HttpRequest request)
{
    if (!request.Cookies.TryGetValue("csrf_token", out var cookieValue))
        return false; // Missing cookie.
    if (!request.Headers.TryGetValue("X-CSRF-Token", out var headerValue))
        return false; // Missing header.
    return string.Equals(cookieValue, headerValue.ToString(), StringComparison.Ordinal); // Must match.
}

// Health check.
app.MapGet("/health", () => Results.Ok(new { ok = true }));

// Register user.
// Public registration cannot choose role.
app.MapPost("/register", async (AppDbContext db, RegisterRequest req) =>
{
    var email = (req.Email ?? "").Trim().ToLowerInvariant(); // Normalize email.
    var password = req.Password ?? ""; // Normalize password.

    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        return Results.BadRequest(new { error = "Email and password are required." });

    try
    {
        _ = new System.Net.Mail.MailAddress(email); // Email format validation.
    }
    catch
    {
        return Results.BadRequest(new { error = "Invalid email format." });
    }

    if (password.Length < 8)
        return Results.BadRequest(new { error = "Password must be at least 8 characters." });

    var exists = await db.Users.AnyAsync(u => u.Email == email); // Prevent duplicate email.
    if (exists)
        return Results.Conflict(new { error = "Email already exists." });

    var user = new User
    {
        Email = email, // Save normalized email.
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(password), // Hash password.
        Role = "MEMBER", // Always default to MEMBER.
        CreatedAtUtc = DateTime.UtcNow // Audit timestamp.
    };

    db.Users.Add(user); // Add user.
    await db.SaveChangesAsync(); // Save.

    return Results.Created($"/users/{user.Id}", new
    {
        user.Id,
        user.Email,
        user.Role
    });
});

// Login endpoint.
app.MapPost("/login", async (AppDbContext db, LoginRequest req, HttpResponse response) =>
{
    var email = (req.Email ?? "").Trim().ToLowerInvariant(); // Normalize email.
    var password = req.Password ?? ""; // Normalize password.

    var user = await db.Users.FirstOrDefaultAsync(x => x.Email == email); // Find user.
    if (user is null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash)) // Verify password.
        return Results.Unauthorized();

    var accessToken = IssueAccessToken(user); // Create access token.

    var refreshRaw = GenerateRefreshToken(); // Generate refresh token.
    db.RefreshTokens.Add(new RefreshToken
    {
        UserId = user.Id,
        TokenHash = HashToken(refreshRaw),
        ExpiresAtUtc = DateTime.UtcNow.AddDays(refreshDays)
    });

    await db.SaveChangesAsync(); // Save refresh token.
    SetRefreshCookie(response, refreshRaw); // Set refresh cookie.

    var csrfToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)); // Generate CSRF token.
    SetCsrfCookie(response, csrfToken); // Set CSRF cookie.

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

// Refresh endpoint.
// Rotates refresh token properly.
app.MapPost("/refresh", async (AppDbContext db, HttpRequest request, HttpResponse response) =>
{
    if (!ValidateCsrf(request))
        return Results.Json(new { error = "CSRF validation failed." }, statusCode: StatusCodes.Status403Forbidden);

    if (!request.Cookies.TryGetValue("refresh_token", out var refreshRaw) || string.IsNullOrWhiteSpace(refreshRaw))
        return Results.Json(new { error = "Missing refresh token." }, statusCode: StatusCodes.Status401Unauthorized);

    var tokenHash = HashToken(refreshRaw); // Hash current token.
    var rt = await db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == tokenHash); // Find token in DB.

    if (rt is null || rt.RevokedAtUtc is not null || rt.ExpiresAtUtc < DateTime.UtcNow)
        return Results.Json(new { error = "Invalid refresh token." }, statusCode: StatusCodes.Status401Unauthorized);

    var user = await db.Users.FindAsync(rt.UserId); // Load user.
    if (user is null)
        return Results.Json(new { error = "Invalid refresh token." }, statusCode: StatusCodes.Status401Unauthorized);

    rt.RevokedAtUtc = DateTime.UtcNow; // Revoke old token.

    var newRefreshRaw = GenerateRefreshToken(); // Generate replacement token.
    db.RefreshTokens.Add(new RefreshToken
    {
        UserId = user.Id,
        TokenHash = HashToken(newRefreshRaw),
        ExpiresAtUtc = DateTime.UtcNow.AddDays(refreshDays)
    });

    await db.SaveChangesAsync(); // Save rotated token.
    SetRefreshCookie(response, newRefreshRaw); // Set new cookie.

    var newCsrfToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)); // Generate new CSRF token.
    SetCsrfCookie(response, newCsrfToken); // Replace CSRF cookie.

    return Results.Ok(new
    {
        accessToken = IssueAccessToken(user), // Return new access token.
        csrfToken = newCsrfToken // Return new CSRF token.
    });
});

// Logout endpoint.
app.MapPost("/logout", async (AppDbContext db, HttpRequest request, HttpResponse response) =>
{
    if (!ValidateCsrf(request))
        return Results.Json(new { error = "CSRF validation failed." }, statusCode: StatusCodes.Status403Forbidden);

    if (request.Cookies.TryGetValue("refresh_token", out var refreshRaw) && !string.IsNullOrWhiteSpace(refreshRaw))
    {
        var tokenHash = HashToken(refreshRaw); // Hash token.
        var rt = await db.RefreshTokens.FirstOrDefaultAsync(x => x.TokenHash == tokenHash); // Find token.
        if (rt is not null && rt.RevokedAtUtc is null)
        {
            rt.RevokedAtUtc = DateTime.UtcNow; // Revoke token.
            await db.SaveChangesAsync(); // Save revocation.
        }
    }

    response.Cookies.Delete("refresh_token"); // Delete refresh cookie.
    response.Cookies.Delete("csrf_token"); // Delete csrf cookie.
    return Results.Ok(new { ok = true }); // Return success.
});

// Current authenticated user endpoint.
app.MapGet("/me", (ClaimsPrincipal user) =>
{
    var sub = GetClaim(user, JwtRegisteredClaimNames.Sub, "sub", ClaimTypes.NameIdentifier); // Resolve user id claim.
    var email = GetClaim(user, JwtRegisteredClaimNames.Email, "email", ClaimTypes.Email); // Resolve email claim.
    var role = GetClaim(user, "role", ClaimTypes.Role); // Resolve role claim.

    return Results.Ok(new { sub, email, role }); // Return clean identity response.
}).RequireAuthorization();

// JWKS endpoint for other services to validate auth tokens.
app.MapGet("/.well-known/jwks.json", () =>
{
    var parameters = rsaPublic.ExportParameters(false); // Export public RSA parameters.
    var e = Base64UrlEncoder.Encode(parameters.Exponent!); // Public exponent.
    var n = Base64UrlEncoder.Encode(parameters.Modulus!); // Public modulus.

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

app.Run(); // Start app.