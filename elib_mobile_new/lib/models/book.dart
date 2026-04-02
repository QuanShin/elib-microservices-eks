class Book {
  final int id;
  final String title;
  final String author;
  final String category;
  final int year;
  final String? description;
  final String? publisher;
  final double? price;
  final String? publishMonth;
  final String? isbn;
  final String? createdAtUtc;

  Book({
    required this.id,
    required this.title,
    required this.author,
    required this.category,
    required this.year,
    this.description,
    this.publisher,
    this.price,
    this.publishMonth,
    this.isbn,
    this.createdAtUtc,
  });

  factory Book.fromJson(Map<String, dynamic> json) {
    return Book(
      id: json['id'] as int,
      title: json['title']?.toString() ?? '',
      author: json['author']?.toString() ?? '',
      category: json['category']?.toString() ?? '',
      year: (json['year'] as num?)?.toInt() ?? 0,
      description: json['description']?.toString(),
      publisher: json['publisher']?.toString(),
      price: (json['price'] as num?)?.toDouble(),
      publishMonth: json['publishMonth']?.toString(),
      isbn: json['isbn']?.toString(),
      createdAtUtc: json['createdAtUtc']?.toString(),
    );
  }
}