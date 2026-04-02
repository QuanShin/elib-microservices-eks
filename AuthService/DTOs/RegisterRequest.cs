namespace AuthService.DTOs; // Put this DTO in the AuthService.DTOs namespace.

// Register only needs email + password. // We intentionally remove Role from public input.
public record RegisterRequest(
    string Email, // User email entered during registration.
    string Password // Raw password entered during registration.
);