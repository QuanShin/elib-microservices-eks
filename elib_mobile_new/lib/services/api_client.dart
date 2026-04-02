import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/api_config.dart';

class ApiClient {
  ApiClient._internal();

  static final ApiClient instance = ApiClient._internal();

  final storage = const FlutterSecureStorage();

  final CookieJar authCookieJar = CookieJar();
  final CookieJar catalogCookieJar = CookieJar();
  final CookieJar borrowCookieJar = CookieJar();

  Dio createAuthDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.authBaseUrl,
        connectTimeout: const Duration(seconds: 45),
        receiveTimeout: const Duration(seconds: 45),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    dio.interceptors.add(CookieManager(authCookieJar));
    dio.interceptors.add(_authInterceptor(dio));
    return dio;
  }

  Dio createCatalogDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.catalogBaseUrl,
        connectTimeout: const Duration(seconds: 45),
        receiveTimeout: const Duration(seconds: 45),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    dio.interceptors.add(CookieManager(catalogCookieJar));
    dio.interceptors.add(_bearerInterceptor());
    return dio;
  }

  Dio createBorrowDio() {
    final dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.borrowBaseUrl,
        connectTimeout: const Duration(seconds: 45),
        receiveTimeout: const Duration(seconds: 45),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    dio.interceptors.add(CookieManager(borrowCookieJar));
    dio.interceptors.add(_bearerInterceptor());
    return dio;
  }

  InterceptorsWrapper _bearerInterceptor() {
    return InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storage.read(key: 'accessToken');
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
    );
  }

  InterceptorsWrapper _authInterceptor(Dio authDio) {
    return InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storage.read(key: 'accessToken');
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final status = error.response?.statusCode;
        final path = error.requestOptions.path;

        if (status == 401 && path != '/refresh' && path != '/login') {
          final refreshed = await tryRefresh(authDio);
          if (refreshed) {
            final retryOptions = error.requestOptions;
            final token = await storage.read(key: 'accessToken');
            if (token != null && token.isNotEmpty) {
              retryOptions.headers['Authorization'] = 'Bearer $token';
            }
            final response = await authDio.fetch(retryOptions);
            return handler.resolve(response);
          }
        }

        handler.next(error);
      },
    );
  }

  Future<bool> tryRefresh(Dio authDio) async {
    try {
      final cookies = await authCookieJar.loadForRequest(Uri.parse(ApiConfig.authBaseUrl));

      String? csrf;
      for (final c in cookies) {
        if (c.name == 'csrf_token') {
          csrf = c.value;
          break;
        }
      }

      final response = await authDio.post(
        '/refresh',
        options: Options(
          headers: csrf != null ? {'X-CSRF-Token': csrf} : {},
        ),
      );

      final token = response.data['accessToken']?.toString();
      if (token == null || token.isEmpty) return false;

      await storage.write(key: 'accessToken', value: token);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> clearSession() async {
    await storage.delete(key: 'accessToken');
    authCookieJar.deleteAll();
    catalogCookieJar.deleteAll();
    borrowCookieJar.deleteAll();
  }
}