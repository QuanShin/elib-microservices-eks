namespace CatalogService.DTOs; // Put this DTO in the CatalogService.DTOs namespace.

public record BookCreate( // DTO for manual book creation from admin UI/API.
    string Title, // Book title.
    string Author, // Author name.
    string Category, // Category.
    string? Description, // Optional description.
    string? Publisher, // Optional publisher.
    decimal? Price, // Optional price.
    string? PublishMonth, // Optional month.
    int Year, // Publish year.
    string? Isbn // Optional ISBN.
);