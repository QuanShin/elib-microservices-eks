namespace CatalogService.Models;

public class Book
{
    public int Id { get; set; }

    public string Title { get; set; } = "";
    public string Author { get; set; } = "";
    public string Category { get; set; } = "";

    public string? Description { get; set; }
    public int Year { get; set; }
    public string? Isbn { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}