using CsvHelper.Configuration;

namespace CatalogService.DTOs;

public sealed class BookImportRowMap : ClassMap<BookImportRow>
{
    public BookImportRowMap()
    {
        Map(m => m.Title).Name("Title");
        Map(m => m.Authors).Name("Authors");
        Map(m => m.Description).Name("Description");
        Map(m => m.Category).Name("Category");
        Map(m => m.Publisher).Name("Publisher");
        Map(m => m.PriceStartingWith).Name("Price Starting With ($)");
        Map(m => m.PublishDateMonth).Name("Publish Date (Month)");
        Map(m => m.PublishDateYear).Name("Publish Date (Year)");
        Map(m => m.CoverImageUrl).Name("CoverImageUrl").Optional();
    }
}