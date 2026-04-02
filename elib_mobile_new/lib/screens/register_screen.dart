import 'package:flutter/material.dart';
import '../services/auth_service.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _authService = AuthService();

  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();

  bool _busy = false;
  String? _error;
  String? _ok;

  Future<void> _register() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final confirm = _confirmController.text;

    setState(() {
      _busy = true;
      _error = null;
      _ok = null;
    });

    try {
      if (email.isEmpty) {
        throw Exception('Email is required.');
      }
      if (password.length < 8) {
        throw Exception('Password must be at least 8 characters.');
      }
      if (password != confirm) {
        throw Exception('Passwords do not match.');
      }

      await _authService.register(
        email: email,
        password: password,
      );

      setState(() {
        _ok = 'Account created successfully. You can log in now.';
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Account'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: ListView(
          children: [
            const Text(
              'Register',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: Color(0xFF183153),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Create a new E-Library account.',
              style: TextStyle(color: Color(0xFF72819A)),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _emailController,
              decoration: const InputDecoration(
                labelText: 'Email',
                prefixIcon: Icon(Icons.mail_outline_rounded),
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _passwordController,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Password',
                prefixIcon: Icon(Icons.lock_outline_rounded),
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _confirmController,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Confirm Password',
                prefixIcon: Icon(Icons.verified_user_outlined),
              ),
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Container(
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
            FilledButton(
              onPressed: _busy ? null : _register,
              child: Text(_busy ? 'Creating account...' : 'Register'),
            ),
          ],
        ),
      ),
    );
  }
}