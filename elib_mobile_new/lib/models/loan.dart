class Loan {
  final int id;
  final int bookId;
  final String borrowedAtUtc;
  final String dueAtUtc;
  final String? returnedAtUtc;

  Loan({
    required this.id,
    required this.bookId,
    required this.borrowedAtUtc,
    required this.dueAtUtc,
    this.returnedAtUtc,
  });

  factory Loan.fromJson(Map<String, dynamic> json) {
    return Loan(
      id: json['id'] as int,
      bookId: json['bookId'] as int,
      borrowedAtUtc: json['borrowedAtUtc']?.toString() ?? '',
      dueAtUtc: json['dueAtUtc']?.toString() ?? '',
      returnedAtUtc: json['returnedAtUtc']?.toString(),
    );
  }
}