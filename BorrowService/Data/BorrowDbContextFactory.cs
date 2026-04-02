using Microsoft.EntityFrameworkCore; // EF Core.
using Microsoft.EntityFrameworkCore.Design; // Design-time EF tooling support.

namespace BorrowService.Data; // Same namespace as BorrowDbContext.

public class BorrowDbContextFactory : IDesignTimeDbContextFactory<BorrowDbContext> // Used by dotnet ef.
{
    public BorrowDbContext CreateDbContext(string[] args) // Called by EF tooling.
    {
        var connectionString = Environment.GetEnvironmentVariable("BORROW_DB_CONNECTION"); // Read design-time connection.

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException("BORROW_DB_CONNECTION is required."); // Fail clearly if missing.
        }

        var optionsBuilder = new DbContextOptionsBuilder<BorrowDbContext>(); // Build options.

        optionsBuilder.UseMySql(
            connectionString, // Use env connection string.
            new MySqlServerVersion(new Version(8, 4, 7)) // Match your server version.
        );

        return new BorrowDbContext(optionsBuilder.Options); // Return context.
    }
}