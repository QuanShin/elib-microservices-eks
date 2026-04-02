namespace BorrowService.Models; // Put entity in BorrowService.Models namespace.

public class Loan // Represents a borrow transaction.
{
    public int Id { get; set; } // Primary key.

    public int UserId { get; set; } // User id from JWT/auth service.
    public int BookId { get; set; } // Book id from catalog service.
    public DateTime BorrowedAtUtc { get; set; } // Borrow timestamp.
    public DateTime DueAtUtc { get; set; } // Due date.
    public DateTime? ReturnedAtUtc { get; set; } // Return timestamp if returned.
}