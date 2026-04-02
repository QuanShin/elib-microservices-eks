namespace AuthService.Models; // Put this entity in the AuthService.Models namespace.

public class User // Represents an application user stored in auth DB.
{
    public int Id { get; set; } // Primary key.

    public string Email { get; set; } = ""; // Unique email address used for login.
    public string PasswordHash { get; set; } = ""; // BCrypt hashed password.
    public string Role { get; set; } = "MEMBER"; // User role, default MEMBER.
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow; // Audit timestamp.

    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>(); // Navigation property.
}