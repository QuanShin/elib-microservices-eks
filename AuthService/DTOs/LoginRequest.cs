namespace AuthService.DTOs; // Put this DTO in the AuthService.DTOs namespace.

// Login only needs email + password.
public record LoginRequest(
    string Email, // User email for login.
    string Password // User password for login.
);