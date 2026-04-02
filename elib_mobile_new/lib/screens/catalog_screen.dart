import 'package:flutter/material.dart';
import '../models/book.dart';
import '../services/catalog_service.dart';

class CatalogScreen extends StatefulWidget {
  final String userEmail;
  final String role;
  final ValueChanged<Book> onOpenBook;

  const CatalogScreen({
    super.key,
    required this.userEmail,
    required this.role,
    required this.onOpenBook,
  });

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final _catalogService = CatalogService();
  final _search = TextEditingController();

  bool _busy = true;
  String? _error;
  List<Book> _books = [];

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final books = await _catalogService.listBooks();
      setState(() => _books = books);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final query = _search.text.trim().toLowerCase();
    final filtered = _books.where((b) {
      if (query.isEmpty) return true;
      return b.title.toLowerCase().contains(query) ||
          b.author.toLowerCase().contains(query) ||
          b.category.toLowerCase().contains(query);
    }).toList();

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFE2EAF4)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x120F172A),
                blurRadius: 24,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: TextField(
            controller: _search,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              hintText: 'Search by title, author, or category',
              prefixIcon: Icon(Icons.search_rounded),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Expanded(
          child: _busy
              ? const Center(child: CircularProgressIndicator())
              : _error != null
                  ? Center(child: Text(_error!))
                  : ListView.separated(
                      itemCount: filtered.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 12),
                      itemBuilder: (context, index) {
                        final book = filtered[index];
                        return InkWell(
                          borderRadius: BorderRadius.circular(22),
                          onTap: () => widget.onOpenBook(book),
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(22),
                              border: Border.all(color: const Color(0xFFE2EAF4)),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x120F172A),
                                  blurRadius: 18,
                                  offset: Offset(0, 8),
                                ),
                              ],
                            ),
                            child: ListTile(
                              contentPadding: const EdgeInsets.all(16),
                              leading: Container(
                                width: 52,
                                height: 72,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  gradient: const LinearGradient(
                                    colors: [Color(0xFF6EA8FF), Color(0xFF695CFF)],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                ),
                                child: Center(
                                  child: Text(
                                    book.category.isNotEmpty ? book.category[0].toUpperCase() : 'B',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 22,
                                    ),
                                  ),
                                ),
                              ),
                              title: Text(
                                book.title,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF183153),
                                ),
                              ),
                              subtitle: Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Text('${book.author} • ${book.category} • ${book.year}'),
                              ),
                              trailing: const Icon(Icons.chevron_right_rounded),
                            ),
                          ),
                        );
                      },
                    ),
        ),
      ],
    );
  }
}