namespace AuthService.Models; // Put this entity in the AuthService.Models namespace.

public class RefreshToken // Represents one stored refresh token row.
{
    public int Id { get; set; } // Primary key.

    public int UserId { get; set; } // FK to User.
    public string TokenHash { get; set; } = ""; // SHA256 hash of the raw refresh token.
    public DateTime ExpiresAtUtc { get; set; } // Expiry time.
    public DateTime? RevokedAtUtc { get; set; } // Revocation time if token was rotated/logged out.

    public User? User { get; set; } // Navigation back to user.
}