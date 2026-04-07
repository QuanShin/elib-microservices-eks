import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/api_config.dart';

class ApiClient {
  ApiClient._internal();

  static final ApiClient instance = ApiClient._internal();

  final FlutterSecureStorage storage = const FlutterSecureStorage();

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
    dio.interceptors.add(_serviceInterceptor(
      dio: dio,
      cookieJar: authCookieJar,
      allowRefresh: true,
    ));
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
    dio.interceptors.add(_serviceInterceptor(
      dio: dio,
      cookieJar: catalogCookieJar,
      allowRefresh: true,
    ));
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
    dio.interceptors.add(_serviceInterceptor(
      dio: dio,
      cookieJar: borrowCookieJar,
      allowRefresh: true,
    ));
    return dio;
  }

  InterceptorsWrapper _serviceInterceptor({
    required Dio dio,
    required CookieJar cookieJar,
    required bool allowRefresh,
  }) {
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

        final isAuthLogin = path == '/login';
        final isAuthRefresh = path == '/refresh';

        if (allowRefresh && status == 401 && !isAuthLogin && !isAuthRefresh) {
          final refreshed = await tryRefresh();

          if (refreshed) {
            try {
              final retryOptions = error.requestOptions;
              final token = await storage.read(key: 'accessToken');

              if (token != null && token.isNotEmpty) {
                retryOptions.headers['Authorization'] = 'Bearer $token';
              }

              final response = await dio.fetch(retryOptions);
              return handler.resolve(response);
            } catch (_) {}
          }
        }

        handler.next(error);
      },
    );
  }

  Future<bool> tryRefresh() async {
    final authDio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.authBaseUrl,
        connectTimeout: const Duration(seconds: 45),
        receiveTimeout: const Duration(seconds: 45),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    authDio.interceptors.add(CookieManager(authCookieJar));

    try {
      final cookies = await authCookieJar.loadForRequest(
        Uri.parse(ApiConfig.authBaseUrl),
      );

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
      if (token == null || token.isEmpty) {
        return false;
      }

      await storage.write(key: 'accessToken', value: token);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> saveAccessToken(String token) async {
    await storage.write(key: 'accessToken', value: token);
  }

  Future<String?> readAccessToken() async {
    return storage.read(key: 'accessToken');
  }

  Future<void> clearSession() async {
    await storage.delete(key: 'accessToken');
    authCookieJar.deleteAll();
    catalogCookieJar.deleteAll();
    borrowCookieJar.deleteAll();
  }
}