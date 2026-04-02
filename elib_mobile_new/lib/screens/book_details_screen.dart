import 'package:flutter/material.dart';
import '../models/book.dart';
import '../services/borrow_service.dart';

class BookDetailsScreen extends StatefulWidget {
  final Book book;
  final String role;
  final VoidCallback onBack;

  const BookDetailsScreen({
    super.key,
    required this.book,
    required this.role,
    required this.onBack,
  });

  @override
  State<BookDetailsScreen> createState() => _BookDetailsScreenState();
}

class _BookDetailsScreenState extends State<BookDetailsScreen> {
  final _borrowService = BorrowService();

  bool _busy = false;
  String? _error;
  String? _ok;

  Future<void> _borrow() async {
    setState(() {
      _busy = true;
      _error = null;
      _ok = null;
    });

    try {
      await _borrowService.checkoutBook(widget.book.id);
      setState(() => _ok = 'Borrowed successfully ✅');
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final b = widget.book;

    return Column(
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: widget.onBack,
            icon: const Icon(Icons.arrow_back_rounded),
            label: const Text('Back'),
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.only(bottom: 24),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(26),
                border: Border.all(color: const Color(0xFFE2EAF4)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x120F172A),
                    blurRadius: 24,
                    offset: Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    b.title,
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF183153),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _chip(b.author),
                      _chip(b.category),
                      _chip('${b.year}'),
                      if (b.publishMonth != null && b.publishMonth!.isNotEmpty)
                        _chip(b.publishMonth!),
                      if (b.publisher != null && b.publisher!.isNotEmpty)
                        _chip(b.publisher!),
                      if (b.isbn != null && b.isbn!.isNotEmpty)
                        _chip('ISBN ${b.isbn!}'),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Text(
                    b.description?.isNotEmpty == true
                        ? b.description!
                        : 'No description available for this book.',
                    style: const TextStyle(
                      height: 1.55,
                      color: Color(0xFF5F718F),
                    ),
                  ),
                  const SizedBox(height: 20),
                  if (_error != null)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF1F3),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Text(
                        _error!,
                        style: const TextStyle(color: Color(0xFFC6284D)),
                      ),
                    ),
                  if (_ok != null)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFFBF4),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Text(
                        _ok!,
                        style: const TextStyle(color: Color(0xFF15803D)),
                      ),
                    ),
                  SafeArea(
                    top: false,
                    child: FilledButton.icon(
                      onPressed: _busy ? null : _borrow,
                      icon: const Icon(Icons.shopping_bag_outlined),
                      label: Text(_busy ? 'Borrowing...' : 'Borrow this book'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _chip(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F8FE),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: const TextStyle(
          fontWeight: FontWeight.w600,
          color: Color(0xFF183153),
        ),
      ),
    );
  }
}