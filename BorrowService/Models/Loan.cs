namespace BorrowService.Models;

public class Loan
{
    public int Id { get; set; }

    // JWT sub -> store as string (safe) or int (if you want). We'll use int because your sub is numeric.
    public int UserId { get; set; }
    public int BookId { get; set; }

    public DateTime BorrowedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime DueAtUtc { get; set; }
    public DateTime? ReturnedAtUtc { get; set; }
}