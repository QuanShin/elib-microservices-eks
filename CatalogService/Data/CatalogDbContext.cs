using CatalogService.Models;
using Microsoft.EntityFrameworkCore;

namespace CatalogService.Data;

public class CatalogDbContext : DbContext
{
    public DbSet<Book> Books => Set<Book>();

    public CatalogDbContext(DbContextOptions<CatalogDbContext> options) : base(options) {}

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Book>()
            .HasIndex(b => b.Title);

        modelBuilder.Entity<Book>()
            .Property(b => b.Title)
            .HasMaxLength(250);

        modelBuilder.Entity<Book>()
            .Property(b => b.Author)
            .HasMaxLength(180);

        modelBuilder.Entity<Book>()
            .Property(b => b.Category)
            .HasMaxLength(120);

        modelBuilder.Entity<Book>()
            .Property(b => b.Isbn)
            .HasMaxLength(40);
    }
}