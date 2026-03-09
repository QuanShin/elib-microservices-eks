using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Security.Claims;

using BorrowService.Data;
using BorrowService.Models;

using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

JwtSecurityTokenHandler.DefaultMapInboundClaims = false;

var builder = WebApplication.CreateBuilder(args);

// -----------------------------
// DB
// -----------------------------
string connStr = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Missing ConnectionStrings:Default");

builder.Services.AddDbContext<BorrowDbContext>(opt =>
    opt.UseMySql(connStr, ServerVersion.AutoDetect(connStr)));

// -----------------------------
// JWT / JWKS
// -----------------------------
string issuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("Missing Jwt:Issuer");

string audience = builder.Configuration["Jwt:Audience"]
    ?? throw new InvalidOperationException("Missing Jwt:Audience");

string jwksUrl = builder.Configuration["Jwt:JwksUrl"]
    ?? throw new InvalidOperationException("Missing Jwt:JwksUrl");

Console.WriteLine($"[BORROW] JWKS URL: {jwksUrl}");

var jwksCache = new JwksCache(jwksUrl);

builder.Services.AddSingleton(jwksCache);
builder.Services.AddSingleton(new JwtValidator(issuer, audience, jwksCache));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

// Custom lightweight JWT middleware
app.Use(async (ctx, next) =>
{
    var auth = ctx.Request.Headers.Authorization.ToString();

    if (!string.IsNullOrWhiteSpace(auth) &&
        auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
    {
        var parts = auth.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var jwt = parts.Length >= 2 ? parts[^1] : "";

        if (!string.IsNullOrWhiteSpace(jwt) && jwt.StartsWith("eyJ", StringComparison.Ordinal))
        {
            var validator = ctx.RequestServices.GetRequiredService<JwtValidator>();
            var principal = await validator.ValidateAsync(jwt);

            if (principal != null)
            {
                var identity = new ClaimsIdentity(principal.Claims, "CustomJwt");
                ctx.User = new ClaimsPrincipal(identity);
            }
        }
    }

    await next();
});

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BorrowDbContext>();
    await db.Database.EnsureCreatedAsync();
}

static int? TryGetUserId(ClaimsPrincipal user)
{
    var sub = user.FindFirstValue("sub");
    return int.TryParse(sub, out var uid) ? uid : null;
}

static bool IsAdmin(ClaimsPrincipal user) =>
    string.Equals(user?.FindFirstValue("role"), "ADMIN", StringComparison.OrdinalIgnoreCase);

app.MapGet("/borrow/health", () => Results.Ok(new { ok = true }));

app.MapGet("/borrow/debug/whoami", (ClaimsPrincipal user) =>
{
    return Results.Ok(new
    {
        isAuthenticated = user?.Identity?.IsAuthenticated ?? false,
        sub = user.FindFirstValue("sub"),
        role = user.FindFirstValue("role"),
        email = user.FindFirstValue("email")
    });
});

app.MapPost("/borrow/checkout/{bookId:int}", async (BorrowDbContext db, ClaimsPrincipal user, int bookId) =>
{
    if (user?.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var uid = TryGetUserId(user);
    if (uid is null) return Results.Unauthorized();

    var activeCount = await db.Loans.CountAsync(l => l.UserId == uid && l.ReturnedAtUtc == null);
    if (activeCount >= 3)
        return Results.Conflict(new { error = "Loan limit reached (max 3 active loans)." });

    var already = await db.Loans.AnyAsync(l => l.UserId == uid && l.BookId == bookId && l.ReturnedAtUtc == null);
    if (already) return Results.Conflict(new { error = "Book already borrowed by this user." });

    var now = DateTime.UtcNow;
    var loan = new Loan
    {
        UserId = uid.Value,
        BookId = bookId,
        BorrowedAtUtc = now,
        DueAtUtc = now.AddDays(14),
        ReturnedAtUtc = null
    };

    db.Loans.Add(loan);
    await db.SaveChangesAsync();

    return Results.Ok(new
    {
        message = "Borrowed",
        loan = new
        {
            loan.Id,
            loan.BookId,
            loan.BorrowedAtUtc,
            loan.DueAtUtc,
            loan.ReturnedAtUtc,
            isOverdue = loan.DueAtUtc < DateTime.UtcNow
        }
    });
});

app.MapPost("/borrow/return/{bookId:int}", async (BorrowDbContext db, ClaimsPrincipal user, int bookId) =>
{
    if (user?.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var uid = TryGetUserId(user);
    if (uid is null) return Results.Unauthorized();

    var loan = await db.Loans
        .Where(l => l.UserId == uid && l.BookId == bookId && l.ReturnedAtUtc == null)
        .OrderByDescending(l => l.BorrowedAtUtc)
        .FirstOrDefaultAsync();

    if (loan is null) return Results.NotFound(new { error = "No active loan found." });

    loan.ReturnedAtUtc = DateTime.UtcNow;
    await db.SaveChangesAsync();

    return Results.Ok(new { message = "Returned", loan });
});

app.MapGet("/borrow/my", async (BorrowDbContext db, ClaimsPrincipal user) =>
{
    if (user?.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var uid = TryGetUserId(user);
    if (uid is null) return Results.Unauthorized();

    var loans = await db.Loans
        .Where(l => l.UserId == uid)
        .OrderByDescending(l => l.BorrowedAtUtc)
        .Select(l => new
        {
            l.Id,
            l.BookId,
            l.BorrowedAtUtc,
            l.DueAtUtc,
            l.ReturnedAtUtc
        })
        .ToListAsync();

    return Results.Ok(loans);
});

app.MapGet("/borrow/admin/all", async (BorrowDbContext db, ClaimsPrincipal user) =>
{
    if (user?.Identity?.IsAuthenticated != true)
        return Results.Unauthorized();

    if (!IsAdmin(user))
        return Results.StatusCode(StatusCodes.Status403Forbidden);

    var loans = await db.Loans
        .OrderByDescending(l => l.BorrowedAtUtc)
        .Select(l => new
        {
            l.Id,
            l.UserId,
            l.BookId,
            l.BorrowedAtUtc,
            l.DueAtUtc,
            l.ReturnedAtUtc
        })
        .ToListAsync();

    return Results.Ok(loans);
});

app.MapGet("/borrow/my/active", async (BorrowDbContext db, ClaimsPrincipal user) =>
{
    if (user?.Identity?.IsAuthenticated != true) return Results.Unauthorized();
    var uid = TryGetUserId(user);
    if (uid is null) return Results.Unauthorized();

    var now = DateTime.UtcNow;

    var active = await db.Loans
        .Where(l => l.UserId == uid && l.ReturnedAtUtc == null)
        .Select(l => new
        {
            l.BookId,
            l.BorrowedAtUtc,
            l.DueAtUtc,
            isOverdue = l.DueAtUtc < now
        })
        .ToListAsync();

    return Results.Ok(active);
});

app.MapGet("/borrow/admin/summary", async (BorrowDbContext db, ClaimsPrincipal user) =>
{
    if (user?.Identity?.IsAuthenticated != true)
        return Results.Unauthorized();

    if (!IsAdmin(user))
        return Results.StatusCode(StatusCodes.Status403Forbidden);

    var now = DateTime.UtcNow;

    var totalLoans = await db.Loans.CountAsync();
    var activeLoans = await db.Loans.CountAsync(l => l.ReturnedAtUtc == null);
    var overdueLoans = await db.Loans.CountAsync(l => l.ReturnedAtUtc == null && l.DueAtUtc < now);

    var topBorrowers = await db.Loans
        .GroupBy(l => l.UserId)
        .Select(g => new { userId = g.Key, total = g.Count() })
        .OrderByDescending(x => x.total)
        .Take(5)
        .ToListAsync();

    return Results.Ok(new { totalLoans, activeLoans, overdueLoans, topBorrowers });
});

app.Run();

sealed class JwtValidator
{
    private readonly string _issuer;
    private readonly string _audience;
    private readonly JwksCache _jwks;

    public JwtValidator(string issuer, string audience, JwksCache jwks)
    {
        _issuer = issuer;
        _audience = audience;
        _jwks = jwks;
    }

    public async Task<ClaimsPrincipal?> ValidateAsync(string jwt)
    {
        var handler = new JwtSecurityTokenHandler();

        JwtSecurityToken parsed;
        try { parsed = handler.ReadJwtToken(jwt); }
        catch { return null; }

        var kid = parsed.Header.Kid;
        var keys = await _jwks.GetSigningKeys(kid);

        var parameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = _issuer,
            ValidateAudience = true,
            ValidAudience = _audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero,
            ValidateIssuerSigningKey = true,
            IssuerSigningKeys = keys
        };

        try
        {
            return handler.ValidateToken(jwt, parameters, out _);
        }
        catch
        {
            return null;
        }
    }
}

sealed class JwksCache
{
    private readonly string _jwksUrl;
    private readonly HttpClient _http = new();
    private readonly object _lock = new();

    private Dictionary<string, SecurityKey> _keysByKid = new();
    private DateTime _nextRefreshUtc = DateTime.MinValue;

    public JwksCache(string jwksUrl) => _jwksUrl = jwksUrl;

    public async Task<IEnumerable<SecurityKey>> GetSigningKeys(string? kid)
    {
        await EnsureFreshAsync();

        lock (_lock)
        {
            if (!string.IsNullOrWhiteSpace(kid) && _keysByKid.TryGetValue(kid, out var key))
                return new[] { key };

            return _keysByKid.Values.ToArray();
        }
    }

    private async Task EnsureFreshAsync()
    {
        if (DateTime.UtcNow < _nextRefreshUtc && _keysByKid.Count > 0) return;

        var jwks = await _http.GetFromJsonAsync<JwksDoc>(_jwksUrl)
                   ?? throw new Exception("Failed to load JWKS.");

        var dict = new Dictionary<string, SecurityKey>(StringComparer.Ordinal);

        foreach (var k in jwks.keys)
        {
            if (k.kty != "RSA") continue;
            if (string.IsNullOrWhiteSpace(k.kid)) continue;

            var pubParams = new System.Security.Cryptography.RSAParameters
            {
                Modulus = Base64UrlEncoder.DecodeBytes(k.n),
                Exponent = Base64UrlEncoder.DecodeBytes(k.e)
            };

            var rsaPub = System.Security.Cryptography.RSA.Create();
            rsaPub.ImportParameters(pubParams);

            dict[k.kid] = new RsaSecurityKey(rsaPub) { KeyId = k.kid };
        }

        lock (_lock)
        {
            _keysByKid = dict;
            _nextRefreshUtc = DateTime.UtcNow.AddHours(6);
        }
    }

    private sealed class JwksDoc
    {
        public JwksKey[] keys { get; set; } = Array.Empty<JwksKey>();
    }

    private sealed class JwksKey
    {
        public string kty { get; set; } = "";
        public string kid { get; set; } = "";
        public string n { get; set; } = "";
        public string e { get; set; } = "";
    }
}