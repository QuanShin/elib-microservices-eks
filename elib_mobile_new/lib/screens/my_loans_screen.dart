import 'package:flutter/material.dart';
import '../models/loan.dart';
import '../services/borrow_service.dart';

class MyLoansScreen extends StatefulWidget {
  final String userEmail;
  final String role;
  final VoidCallback onOpenCatalog;

  const MyLoansScreen({
    super.key,
    required this.userEmail,
    required this.role,
    required this.onOpenCatalog,
  });

  @override
  State<MyLoansScreen> createState() => _MyLoansScreenState();
}

class _MyLoansScreenState extends State<MyLoansScreen> {
  final _borrowService = BorrowService();

  bool _busy = true;
  String? _error;
  List<Loan> _loans = [];

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final loans = await _borrowService.myLoans();
      setState(() => _loans = loans);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _returnLoan(int loanId) async {
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await _borrowService.returnLoan(loanId);
      await _load();
    } catch (e) {
      setState(() => _error = e.toString());
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
    final active = _loans.where((l) => l.returnedAtUtc == null).toList();
    final history = _loans.where((l) => l.returnedAtUtc != null).toList();

    return Column(
      children: [
        if (_busy) const LinearProgressIndicator(),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(_error!, style: const TextStyle(color: Color(0xFFC6284D))),
          ),
        Expanded(
          child: ListView(
            children: [
              _sectionTitle('Active Loans'),
              if (active.isEmpty)
                _emptyCard('No active loans yet.')
              else
                ...active.map((loan) => _loanCard(loan, false)),
              const SizedBox(height: 18),
              _sectionTitle('History'),
              if (history.isEmpty)
                _emptyCard('No returned loans yet.')
              else
                ...history.map((loan) => _loanCard(loan, true)),
            ],
          ),
        ),
      ],
    );
  }

  Widget _sectionTitle(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w800,
          color: Color(0xFF183153),
        ),
      ),
    );
  }

  Widget _emptyCard(String text) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE2EAF4)),
      ),
      child: Text(text, style: const TextStyle(color: Color(0xFF72819A))),
    );
  }

  Widget _loanCard(Loan loan, bool isHistory) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Book ID: ${loan.bookId}',
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                color: Color(0xFF183153),
              )),
          const SizedBox(height: 8),
          Text('Borrowed: ${loan.borrowedAtUtc}', style: const TextStyle(color: Color(0xFF72819A))),
          const SizedBox(height: 4),
          Text(
            isHistory ? 'Returned: ${loan.returnedAtUtc}' : 'Due: ${loan.dueAtUtc}',
            style: const TextStyle(color: Color(0xFF72819A)),
          ),
          if (!isHistory) ...[
            const SizedBox(height: 14),
            FilledButton(
              onPressed: _busy ? null : () => _returnLoan(loan.id),
              child: const Text('Return Book'),
            ),
          ],
        ],
      ),
    );
  }
}