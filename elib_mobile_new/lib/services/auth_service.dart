import 'package:dio/dio.dart';
import '../models/user_profile.dart';
import 'api_client.dart';

class AuthService {
  final _api = ApiClient.instance;
  late final Dio _dio = _api.createAuthDio();

  Future<void> register({
    required String email,
    required String password,
  }) async {
    await _dio.post(
      '/register',
      data: {
        'email': email,
        'password': password,
      },
    );
  }

  Future<UserProfile> login({
    required String email,
    required String password,
  }) async {
    final response = await _dio.post(
      '/login',
      data: {
        'email': email,
        'password': password,
      },
    );

    final token = response.data['accessToken']?.toString();
    if (token == null || token.isEmpty) {
      throw Exception('Login failed: missing access token');
    }

    await _api.storage.write(key: 'accessToken', value: token);

    return me();
  }

  Future<UserProfile> me() async {
    final response = await _dio.get('/me');
    return UserProfile.fromJson(Map<String, dynamic>.from(response.data));
  }

  Future<void> logout() async {
    final cookies = await _api.authCookieJar.loadForRequest(Uri.parse(_dio.options.baseUrl));

    String? csrf;
    for (final c in cookies) {
      if (c.name == 'csrf_token') {
        csrf = c.value;
        break;
      }
    }

    await _dio.post(
      '/logout',
      options: Options(
        headers: csrf != null ? {'X-CSRF-Token': csrf} : {},
      ),
    );

    await _api.clearSession();
  }
}