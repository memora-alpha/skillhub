import 'dart:convert';

import 'package:dio/dio.dart';

import 'app_error.dart';

abstract interface class SessionTransport {
  int get generation;
  Future<String?> getToken();
  Future<void> renew([String? staleToken]);
  Future<void> expire();
}

bool isRecord(Object? value) => value is Map<String, dynamic>;

Object? readPayload(int status, Object? payload) {
  if (status == 204) return null;
  if (status < 200 || status >= 300) {
    // Only accept known-shaped codes, never display arbitrary server text or details.
    final message = payload is Map<String, dynamic> ? payload['message'] : null;
    final code = message is String && RegExp(r'^[A-Z_]+$').hasMatch(message)
        ? message
        : '';
    throw AppError(AppErrorKind.http, status: status, code: code);
  }
  if (payload is! Map<String, dynamic> ||
      payload['success'] != true ||
      !payload.containsKey('data')) {
    throw const AppError.protocol();
  }
  return payload['data'];
}

class ApiEnvelope {
  const ApiEnvelope(this.data, [this.meta = const {}]);

  final Object? data;
  final Map<String, dynamic> meta;
}

ApiEnvelope readEnvelope(int status, Object? payload) {
  if (status == 204) return const ApiEnvelope(null);
  if (status < 200 || status >= 300) {
    readPayload(status, payload);
  }
  if (payload is! Map<String, dynamic> ||
      payload['success'] != true ||
      !payload.containsKey('data')) {
    throw const AppError.protocol();
  }
  final meta = payload['meta'];
  if (meta != null && meta is! Map<String, dynamic>) {
    throw const AppError.protocol();
  }
  return ApiEnvelope(payload['data'], meta ?? const {});
}

Map<String, dynamic> asMap(Object? value) {
  if (value is! Map<String, dynamic>) throw const AppError.protocol();
  return value;
}

String asString(Object? value) {
  if (value is! String || value.isEmpty) throw const AppError.protocol();
  return value;
}

String asText(Object? value) {
  if (value is! String) throw const AppError.protocol();
  return value;
}

String? asOptionalString(Object? value) {
  if (value == null) return null;
  if (value is! String) throw const AppError.protocol();
  return value;
}

int asInt(Object? value) {
  if (value is! int) throw const AppError.protocol();
  return value;
}

bool asBool(Object? value) {
  if (value is! bool) throw const AppError.protocol();
  return value;
}

List<T> asList<T>(Object? value, T Function(Object? item) parse) {
  if (value is! List) throw const AppError.protocol();
  return [for (final item in value) parse(item)];
}

String withQuery(String path, Map<String, Object?> query) {
  final parts = [
    for (final entry in query.entries)
      if (entry.value != null)
        '${entry.key}=${Uri.encodeQueryComponent('${entry.value}')}',
  ];
  return parts.isEmpty ? path : '$path?${parts.join('&')}';
}

class Page<T> {
  const Page(this.items, {this.nextCursor});

  final List<T> items;
  final String? nextCursor;

  static Page<T> parse<T>(ApiEnvelope envelope, T Function(Object?) parseItem) {
    final pagination = envelope.meta['pagination'];
    if (pagination != null && pagination is! Map<String, dynamic>) {
      throw const AppError.protocol();
    }
    final cursor = pagination is Map<String, dynamic>
        ? pagination['nextCursor']
        : null;
    if (cursor != null && cursor is! String) throw const AppError.protocol();
    return Page(
      asList(envelope.data, parseItem),
      nextCursor: cursor as String?,
    );
  }
}

class HttpClient {
  HttpClient(this._baseUrl, {Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              connectTimeout: const Duration(seconds: 20),
              sendTimeout: const Duration(seconds: 20),
              receiveTimeout: const Duration(seconds: 20),
              validateStatus: (_) => true,
              responseType: ResponseType.plain,
            ),
          );

  final String Function() _baseUrl;
  final Dio _dio;
  SessionTransport? _session;

  void bindSession(SessionTransport transport) => _session = transport;

  Future<ApiEnvelope> _send(
    String path,
    String method,
    Object? body,
    String? token, [
    Map<String, String> headers = const {},
  ]) async {
    final Response<String> response;
    try {
      final data = body is FormData ? body.clone() : body;
      response = await _dio.request<String>(
        '${_baseUrl()}$path',
        data: data == null || data is FormData ? data : jsonEncode(data),
        options: Options(
          method: method,
          headers: {
            'Accept': 'application/json',
            if (token != null) 'Authorization': 'Bearer $token',
            ...headers,
          },
          contentType: body == null || body is FormData
              ? null
              : Headers.jsonContentType,
        ),
      );
    } on AppError {
      rethrow;
    } catch (_) {
      throw const AppError(AppErrorKind.network);
    }
    final raw = response.data ?? '';
    Object? payload;
    if (raw.trim().isNotEmpty) {
      try {
        payload = jsonDecode(raw);
      } on FormatException {
        payload = null;
      }
    }
    return readEnvelope(response.statusCode ?? 0, payload);
  }

  Future<Object?> request(
    String path, {
    String method = 'GET',
    Object? body,
    bool authenticated = false,
    Map<String, String> headers = const {},
  }) async =>
      (await requestEnvelope(
        path,
        method: method,
        body: body,
        authenticated: authenticated,
        headers: headers,
      )).data;

  Future<ApiEnvelope> requestEnvelope(
    String path, {
    String method = 'GET',
    Object? body,
    bool authenticated = false,
    Map<String, String> headers = const {},
  }) async {
    if (!path.startsWith('/') || path.startsWith('//')) {
      throw const AppError(AppErrorKind.config);
    }
    if (!authenticated) return _send(path, method, body, null, headers);
    final transport = _session;
    if (transport == null) throw const AppError.session();
    final generation = transport.generation;
    void assertCurrentSession() {
      if (!identical(_session, transport) ||
          transport.generation != generation) {
        throw const AppError.session();
      }
    }

    final token = await transport.getToken();
    assertCurrentSession();
    if (token == null) throw const AppError.session();
    try {
      final result = await _send(path, method, body, token, headers);
      assertCurrentSession();
      return result;
    } on AppError catch (error) {
      assertCurrentSession();
      if (error.status != 401) {
        if (error.code == 'ACCOUNT_NOT_ACTIVE') await transport.expire();
        rethrow;
      }
    }
    await transport.renew(token);
    assertCurrentSession();
    final nextToken = await transport.getToken();
    assertCurrentSession();
    if (nextToken == null) throw const AppError.session();
    try {
      final result = await _send(path, method, body, nextToken, headers);
      assertCurrentSession();
      return result;
    } on AppError catch (error) {
      assertCurrentSession();
      if (error.status == 401 || error.code == 'ACCOUNT_NOT_ACTIVE') {
        await transport.expire();
      }
      rethrow;
    }
  }
}
