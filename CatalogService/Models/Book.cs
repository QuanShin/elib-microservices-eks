namespace CatalogService.Models; // Put this entity in the CatalogService.Models namespace.

public class Book // Entity stored in database.
{
    public int Id { get; set; } // Primary key.

    public string Title { get; set; } = ""; // Book title.
    public string Author { get; set; } = ""; // Main author string.
    public string Category { get; set; } = ""; // Category/genre text.
    public string? Description { get; set; } // Optional description.

    public string? Publisher { get; set; } // Optional publisher.
    public decimal? Price { get; set; } // Optional price from CSV.
    public string? PublishMonth { get; set; } // Optional publish month from CSV.
    public int Year { get; set; } // Publish year.

    public string? Isbn { get; set; } // Optional ISBN.
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow; // Audit column for creation time.
}