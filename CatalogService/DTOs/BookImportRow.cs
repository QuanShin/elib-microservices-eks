namespace CatalogService.DTOs; // Put import DTO in DTO namespace.

public class BookImportRow // Represents a single CSV row from BooksDatasetClean.csv.
{
    public string? Title { get; set; } // CSV Title column.
    public string? Authors { get; set; } // CSV Authors column.
    public string? Description { get; set; } // CSV Description column.
    public string? Category { get; set; } // CSV Category column.
    public string? Publisher { get; set; } // CSV Publisher column.
    public decimal? PriceStartingWith { get; set; } // CSV Price Starting With ($) column.
    public string? PublishDateMonth { get; set; } // CSV Publish Date (Month) column.
    public int? PublishDateYear { get; set; } // CSV Publish Date (Year) column.
}