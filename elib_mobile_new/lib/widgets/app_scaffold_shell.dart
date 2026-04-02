import 'package:flutter/material.dart';
import 'app_drawer_menu.dart';

class AppScaffoldShell extends StatelessWidget {
  final String title;
  final String subtitle;
  final String email;
  final String role;
  final Widget body;
  final VoidCallback onCatalog;
  final VoidCallback onLoans;
  final VoidCallback? onAddBook;
  final VoidCallback? onAdmin;
  final VoidCallback onLogout;
  final List<Widget>? actions;

  const AppScaffoldShell({
    super.key,
    required this.title,
    required this.subtitle,
    required this.email,
    required this.role,
    required this.body,
    required this.onCatalog,
    required this.onLoans,
    this.onAddBook,
    this.onAdmin,
    required this.onLogout,
    this.actions,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: AppDrawerMenu(
        email: email,
        role: role,
        onCatalog: onCatalog,
        onLoans: onLoans,
        onAddBook: onAddBook,
        onAdmin: onAdmin,
        onLogout: onLogout,
      ),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
        actions: actions,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: body,
        ),
      ),
    );
  }
}