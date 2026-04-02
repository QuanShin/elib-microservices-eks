using CsvHelper.Configuration; // CsvHelper mapping types.

namespace CatalogService.DTOs; // Put CSV map in DTO namespace.

public sealed class BookImportRowMap : ClassMap<BookImportRow> // Maps CSV headers to DTO properties.
{
    public BookImportRowMap() // Constructor where mapping is configured.
    {
        Map(m => m.Title).Name("Title"); // Map CSV column Title.
        Map(m => m.Authors).Name("Authors"); // Map CSV column Authors.
        Map(m => m.Description).Name("Description"); // Map CSV column Description.
        Map(m => m.Category).Name("Category"); // Map CSV column Category.
        Map(m => m.Publisher).Name("Publisher"); // Map CSV column Publisher.
        Map(m => m.PriceStartingWith).Name("Price Starting With ($)"); // Map CSV price column.
        Map(m => m.PublishDateMonth).Name("Publish Date (Month)"); // Map CSV month column.
        Map(m => m.PublishDateYear).Name("Publish Date (Year)"); // Map CSV year column.
    }
}