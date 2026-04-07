namespace CatalogService.DTOs;

public record BookCreate(
    string Title,
    string Author,
    string Category,
    string? Description,
    string? Publisher,
    decimal? Price,
    string? PublishMonth,
    int Year,
    string? Isbn,
    string? CoverImageUrl
);