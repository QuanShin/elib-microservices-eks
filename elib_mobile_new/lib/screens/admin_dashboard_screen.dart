import 'package:flutter/material.dart';
import '../models/borrow_summary.dart';
import '../services/borrow_service.dart';

class AdminDashboardScreen extends StatefulWidget {
  final String userEmail;
  final String role;

  const AdminDashboardScreen({
    super.key,
    required this.userEmail,
    required this.role,
  });

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  final _borrowService = BorrowService();

  bool _busy = true;
  String? _error;
  BorrowSummary? _summary;

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final summary = await _borrowService.adminSummary();
      setState(() => _summary = summary);
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
    final total = _summary?.total ?? 0;
    final active = _summary?.active ?? 0;
    final returned = _summary?.returned ?? 0;

    final activePct = total == 0 ? 0.0 : active / total;
    final returnedPct = total == 0 ? 0.0 : returned / total;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        children: [
          if (_busy) const LinearProgressIndicator(),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _messageCard(
                color: const Color(0xFFFFF1F3),
                textColor: const Color(0xFFC6284D),
                text: _error!,
              ),
            ),

          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(28),
              gradient: const LinearGradient(
                colors: [Color(0xFF5A86FF), Color(0xFF6D5CFF)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x220F172A),
                  blurRadius: 24,
                  offset: Offset(0, 10),
                ),
              ],
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Library Activity Overview',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: 8),
                Text(
                  'A polished visual summary of borrowing activity, returns, and circulation balance.',
                  style: TextStyle(
                    color: Color(0xFFE9EEFF),
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          Row(
            children: [
              Expanded(
                child: _metricCard(
                  label: 'Total Loans',
                  value: '$total',
                  icon: Icons.auto_graph_rounded,
                  tint: const Color(0xFF4F7CFF),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _metricCard(
                  label: 'Active',
                  value: '$active',
                  icon: Icons.bookmark_rounded,
                  tint: const Color(0xFF8B5CF6),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          _metricCard(
            label: 'Returned',
            value: '$returned',
            icon: Icons.assignment_turned_in_rounded,
            tint: const Color(0xFF10B981),
          ),

          const SizedBox(height: 16),

          _insightPanel(
            title: 'Borrowing Balance',
            subtitle: 'Live distribution of current active loans versus completed returns.',
            children: [
              _progressBlock(
                label: 'Active Loans',
                value: active,
                total: total,
                percent: activePct,
                color: const Color(0xFF8B5CF6),
              ),
              const SizedBox(height: 16),
              _progressBlock(
                label: 'Returned Loans',
                value: returned,
                total: total,
                percent: returnedPct,
                color: const Color(0xFF10B981),
              ),
            ],
          ),

          const SizedBox(height: 16),

          _insightPanel(
            title: 'Quick Interpretation',
            subtitle: 'A readable management summary for administrators.',
            children: [
              _insightRow(
                icon: Icons.info_outline_rounded,
                text: total == 0
                    ? 'No loan activity has been recorded yet.'
                    : 'There are $total total loan records in the system.',
              ),
              const SizedBox(height: 10),
              _insightRow(
                icon: Icons.menu_book_rounded,
                text: active == 0
                    ? 'There are no currently active loans.'
                    : '$active loan(s) are currently active and still out.',
              ),
              const SizedBox(height: 10),
              _insightRow(
                icon: Icons.assignment_turned_in_rounded,
                text: returned == 0
                    ? 'No books have been returned yet.'
                    : '$returned loan(s) have already been returned.',
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _metricCard({
    required String label,
    required String value,
    required IconData icon,
    required Color tint,
  }) {
    return Container(
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
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: tint.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: tint),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(color: Color(0xFF72819A)),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF183153),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _insightPanel({
    required String title,
    required String subtitle,
    required List<Widget> children,
  }) {
    return Container(
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
          Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 18,
              color: Color(0xFF183153),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: const TextStyle(
              color: Color(0xFF72819A),
              height: 1.45,
            ),
          ),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }

  Widget _progressBlock({
    required String label,
    required int value,
    required int total,
    required double percent,
    required Color color,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF183153),
                ),
              ),
            ),
            Text(
              '${(percent * 100).round()}%',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: Color(0xFF183153),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: percent,
            minHeight: 16,
            backgroundColor: const Color(0xFFE9EFFB),
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '$value of $total',
          style: const TextStyle(color: Color(0xFF72819A)),
        ),
      ],
    );
  }

  Widget _insightRow({required IconData icon, required String text}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: const Color(0xFF4F7CFF)),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              color: Color(0xFF5F718F),
              height: 1.45,
            ),
          ),
        ),
      ],
    );
  }

  Widget _messageCard({
    required Color color,
    required Color textColor,
    required String text,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(text, style: TextStyle(color: textColor)),
    );
  }
}