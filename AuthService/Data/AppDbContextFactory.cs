using Microsoft.EntityFrameworkCore; // EF Core types.
using Microsoft.EntityFrameworkCore.Design; // Design-time factory support.

namespace AuthService.Data; // Same namespace as DbContext.

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext> // Used by dotnet ef at design time.
{
    public AppDbContext CreateDbContext(string[] args) // Called by EF tooling.
    {
        var connectionString = Environment.GetEnvironmentVariable("AUTH_DB_CONNECTION"); // Read from env only.

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("AUTH_DB_CONNECTION is required."); // Fail clearly if missing.
        }

        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>(); // Build DbContext options.

        optionsBuilder.UseMySql(
            connectionString, // Use provided connection string.
            new MySqlServerVersion(new Version(8, 4, 7)) // Match your MySQL server version.
        );

        return new AppDbContext(optionsBuilder.Options); // Return configured DbContext.
    }
}