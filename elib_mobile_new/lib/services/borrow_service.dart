import 'package:dio/dio.dart';
import '../models/borrow_summary.dart';
import '../models/loan.dart';
import 'api_client.dart';

class BorrowService {
  final _api = ApiClient.instance;
  late final Dio _dio = _api.createBorrowDio();

  Future<List<Loan>> myLoans() async {
    final response = await _dio.get('/borrow/my-loans');
    final data = response.data as List;
    return data.map((e) => Loan.fromJson(Map<String, dynamic>.from(e))).toList();
  }

  Future<void> checkoutBook(int bookId) async {
    await _dio.post('/borrow/checkout/$bookId');
  }

  Future<void> returnLoan(int loanId) async {
    await _dio.post('/borrow/return/$loanId');
  }

  Future<BorrowSummary> adminSummary() async {
    final response = await _dio.get('/borrow/admin/summary');
    return BorrowSummary.fromJson(Map<String, dynamic>.from(response.data));
  }
}