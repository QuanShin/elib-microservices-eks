import 'package:dio/dio.dart';
import '../models/book.dart';
import 'api_client.dart';

class CatalogService {
  final _api = ApiClient.instance;
  late final Dio _dio = _api.createCatalogDio();

  Future<List<Book>> listBooks() async {
    final response = await _dio.get('/catalog/books');
    final data = response.data as List;
    return data.map((e) => Book.fromJson(Map<String, dynamic>.from(e))).toList();
  }

  Future<Book> getBook(int id) async {
    final response = await _dio.get('/catalog/books/$id');
    return Book.fromJson(Map<String, dynamic>.from(response.data));
  }

  Future<Book> createBook({
    required String title,
    required String author,
    required String category,
    required int year,
    String? description,
    String? publisher,
    double? price,
    String? publishMonth,
    String? isbn,
  }) async {
    final response = await _dio.post(
      '/catalog/books',
      data: {
        'title': title,
        'author': author,
        'category': category,
        'year': year,
        'description': description,
        'publisher': publisher,
        'price': price,
        'publishMonth': publishMonth,
        'isbn': isbn,
      },
    );

    return Book.fromJson(Map<String, dynamic>.from(response.data));
  }
}