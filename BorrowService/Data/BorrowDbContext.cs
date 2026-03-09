using BorrowService.Models;
using Microsoft.EntityFrameworkCore;

namespace BorrowService.Data;

public class BorrowDbContext : DbContext
{
    public DbSet<Loan> Loans => Set<Loan>();

    public BorrowDbContext(DbContextOptions<BorrowDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Loan>()
            .HasIndex(x => new { x.UserId, x.BookId, x.ReturnedAtUtc });

        // prevent duplicate active loans for the same book by same user (soft enforcement)
        modelBuilder.Entity<Loan>()
            .HasIndex(x => new { x.UserId, x.BookId })
            .HasDatabaseName("IX_User_Book");
    }
}