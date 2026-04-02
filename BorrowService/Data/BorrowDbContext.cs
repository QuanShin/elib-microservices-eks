using BorrowService.Models; // Import Loan model.
using Microsoft.EntityFrameworkCore; // EF Core.

namespace BorrowService.Data; // DbContext namespace.

public class BorrowDbContext : DbContext // Borrow database context.
{
    public BorrowDbContext(DbContextOptions<BorrowDbContext> options) : base(options) // Standard constructor.
    {
    }

    public DbSet<Loan> Loans => Set<Loan>(); // Loans table.

    protected override void OnModelCreating(ModelBuilder modelBuilder) // Configure indexes.
    {
        modelBuilder.Entity<Loan>()
            .HasIndex(x => new { x.UserId, x.BookId, x.ReturnedAtUtc }); // Helps duplicate-active-loan checks.
    }
}