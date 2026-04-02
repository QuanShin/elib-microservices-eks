import 'package:flutter/material.dart';

class AppDrawerMenu extends StatelessWidget {
  final String email;
  final String role;
  final VoidCallback onCatalog;
  final VoidCallback onLoans;
  final VoidCallback? onAddBook;
  final VoidCallback? onAdmin;
  final VoidCallback onLogout;

  const AppDrawerMenu({
    super.key,
    required this.email,
    required this.role,
    required this.onCatalog,
    required this.onLoans,
    this.onAddBook,
    this.onAdmin,
    required this.onLogout,
  });

  @override
  Widget build(BuildContext context) {
    final initial = email.isNotEmpty ? email[0].toUpperCase() : 'U';
    final isAdmin = role == 'ADMIN';

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
                        initial,
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
                            email,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF183153),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            role,
                            style: const TextStyle(color: Color(0xFF72819A)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              _tile(Icons.auto_stories_rounded, 'Discover', onCatalog),
              _tile(Icons.bookmark_rounded, 'My Loans', onLoans),
              if (isAdmin && onAddBook != null)
                _tile(Icons.library_add_rounded, 'Add Book', onAddBook!),
              if (isAdmin && onAdmin != null)
                _tile(Icons.insights_rounded, 'Admin Dashboard', onAdmin!),
              const Spacer(),
              _tile(Icons.logout_rounded, 'Logout', onLogout, danger: true),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tile(IconData icon, String title, VoidCallback onTap, {bool danger = false}) {
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
}