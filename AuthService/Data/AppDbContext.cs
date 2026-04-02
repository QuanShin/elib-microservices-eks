using AuthService.Models; // Import entity models.
using Microsoft.EntityFrameworkCore; // EF Core types.

namespace AuthService.Data; // DbContext namespace.

public class AppDbContext : DbContext // Auth database context.
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) // Standard EF constructor.
    {
    }

    public DbSet<User> Users => Set<User>(); // Users table.
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>(); // RefreshTokens table.

    protected override void OnModelCreating(ModelBuilder modelBuilder) // Configure indexes/relations.
    {
        modelBuilder.Entity<User>()
            .HasIndex(x => x.Email) // Email must be unique.
            .IsUnique();

        modelBuilder.Entity<RefreshToken>()
            .HasIndex(x => x.TokenHash) // Token hash should be unique.
            .IsUnique();

        modelBuilder.Entity<RefreshToken>()
            .HasOne(x => x.User) // One refresh token belongs to one user.
            .WithMany(x => x.RefreshTokens) // One user has many refresh tokens.
            .HasForeignKey(x => x.UserId) // FK column.
            .OnDelete(DeleteBehavior.Cascade); // Delete tokens if user is deleted.
    }
}