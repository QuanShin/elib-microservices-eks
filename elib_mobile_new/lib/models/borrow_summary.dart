class BorrowSummary {
  final int total;
  final int active;
  final int returned;

  BorrowSummary({
    required this.total,
    required this.active,
    required this.returned,
  });

  factory BorrowSummary.fromJson(Map<String, dynamic> json) {
    return BorrowSummary(
      total: (json['total'] as num?)?.toInt() ?? 0,
      active: (json['active'] as num?)?.toInt() ?? 0,
      returned: (json['returned'] as num?)?.toInt() ?? 0,
    );
  }
}