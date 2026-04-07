namespace CatalogService.DTOs;

public class BookImportRow
{
    public string? Title { get; set; }
    public string? Authors { get; set; }
    public string? Description { get; set; }
    public string? Category { get; set; }
    public string? Publisher { get; set; }
    public decimal? PriceStartingWith { get; set; }
    public string? PublishDateMonth { get; set; }
    public int? PublishDateYear { get; set; }
    public string? CoverImageUrl { get; set; }
}