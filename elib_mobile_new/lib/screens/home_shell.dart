import 'package:flutter/material.dart';
import '../models/book.dart';
import '../services/auth_service.dart';
import 'admin_dashboard_screen.dart';
import 'book_details_screen.dart';
import 'catalog_screen.dart';
import 'login_screen.dart';
import 'my_loans_screen.dart';

enum AppSection {
  catalog,
  loans,
  admin,
}

class HomeShell extends StatefulWidget {
  final String userEmail;
  final String role;

  const HomeShell({
    super.key,
    required this.userEmail,
    required this.role,
  });

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  final _authService = AuthService();

  AppSection _section = AppSection.catalog;
  Book? _selectedBook;
  bool _showDetails = false;

  bool get isAdmin => widget.role == 'ADMIN';

  Future<void> _logout() async {
    await _authService.logout();

    if (!mounted) return;

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  void _openCatalog() {
    setState(() {
      _section = AppSection.catalog;
      _showDetails = false;
      _selectedBook = null;
    });
    Navigator.of(context).maybePop();
  }

  void _openLoans() {
    setState(() {
      _section = AppSection.loans;
      _showDetails = false;
      _selectedBook = null;
    });
    Navigator.of(context).maybePop();
  }

  void _openAdmin() {
    setState(() {
      _section = AppSection.admin;
      _showDetails = false;
      _selectedBook = null;
    });
    Navigator.of(context).maybePop();
  }

  void _openBookDetails(Book book) {
    setState(() {
      _selectedBook = book;
      _showDetails = true;
    });
  }

  void _backFromDetails() {
    setState(() {
      _showDetails = false;
      _selectedBook = null;
    });
  }

  Widget _buildDrawer() {
    return Drawer(
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'E-Library',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF183153),
                ),
              ),
              const SizedBox(height: 18),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F8FE),
                  borderRadius: BorderRadius.circular(22),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 26,
                      backgroundColor: const Color(0xFF4F7CFF),
                      child: Text(
                        widget.userEmail.isNotEmpty ? widget.userEmail[0].toUpperCase() : 'U',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.userEmail,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF183153),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.role,
                            style: const TextStyle(color: Color(0xFF72819A)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              _drawerTile(Icons.auto_stories_rounded, 'Discover', _openCatalog),
              _drawerTile(Icons.bookmark_rounded, 'My Loans', _openLoans),
              if (isAdmin)
                _drawerTile(Icons.insights_rounded, 'Admin Dashboard', _openAdmin),
              const Spacer(),
              _drawerTile(Icons.logout_rounded, 'Logout', _logout, danger: true),
            ],
          ),
        ),
      ),
    );
  }

  Widget _drawerTile(IconData icon, String title, VoidCallback onTap, {bool danger = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        tileColor: danger ? const Color(0xFFFFF1F3) : const Color(0xFFF7FAFF),
        leading: Icon(icon, color: danger ? const Color(0xFFC6284D) : const Color(0xFF4F7CFF)),
        title: Text(
          title,
          style: TextStyle(
            fontWeight: FontWeight.w700,
            color: danger ? const Color(0xFFC6284D) : const Color(0xFF183153),
          ),
        ),
        onTap: onTap,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    String title;
    String subtitle;

    if (_showDetails && _selectedBook != null) {
      body = BookDetailsScreen(
        book: _selectedBook!,
        role: widget.role,
        onBack: _backFromDetails,
      );
      title = 'Book Details';
      subtitle = 'Inspect and borrow this book';
    } else {
      switch (_section) {
        case AppSection.catalog:
          body = CatalogScreen(
            userEmail: widget.userEmail,
            role: widget.role,
            onOpenBook: _openBookDetails,
          );
          title = 'Discover';
          subtitle = 'Browse the library collection';
          break;
        case AppSection.loans:
          body = MyLoansScreen(
            userEmail: widget.userEmail,
            role: widget.role,
            onOpenCatalog: _openCatalog,
          );
          title = 'My Loans';
          subtitle = 'Track borrowed and returned books';
          break;
        case AppSection.admin:
          body = AdminDashboardScreen(
            userEmail: widget.userEmail,
            role: widget.role,
          );
          title = 'Admin Dashboard';
          subtitle = 'Visual overview of library activity';
          break;
      }
    }

    return Scaffold(
      drawer: _buildDrawer(),
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title),
            Text(
              subtitle,
              style: const TextStyle(fontSize: 12, color: Color(0xFF72819A)),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: body,
        ),
      ),
    );
  }
}