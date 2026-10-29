import 'package:dio/dio.dart';

import '../../../core/http/http_client.dart';

class MaterialsApi {
  MaterialsApi(this._client);

  final HttpClient _client;

  Future<List<Map<String, dynamic>>> mine() async => asList(
    await _client.request('/me/materials', authenticated: true),
    asMap,
  );

  Future<Map<String, dynamic>> upload(FormData body) async => asMap(
    await _client.request(
      '/me/materials/files',
      method: 'POST',
      body: body,
      authenticated: true,
    ),
  );

  Future<Map<String, dynamic>> fileStatus(String fileId) async => asMap(
    await _client.request('/me/materials/files/$fileId', authenticated: true),
  );

  Future<Map<String, dynamic>> create(Map<String, Object?> body) =>
      _json('/me/materials', 'POST', body);

  Future<Map<String, dynamic>> update(String id, Map<String, Object?> body) =>
      _json('/me/materials/$id', 'PATCH', body);

  Future<Map<String, dynamic>> submit(String id) =>
      _json('/me/materials/$id/submit', 'POST', const {});

  Future<Map<String, dynamic>> archive(String id) =>
      _json('/me/materials/$id/archive', 'POST', const {});

  Future<List<Map<String, dynamic>>> search({
    String? q,
    String? accessType,
  }) async => asList(
    await _client.request(
      withQuery('/materials', {
        'q': q == null || q.isEmpty ? null : q,
        'accessType': accessType,
        'page': 1,
        'limit': 20,
      }),
    ),
    asMap,
  );

  Future<Map<String, dynamic>> detail(String id) async => asMap(
    await _client.request('/materials/$id'),
  );

  Future<Map<String, dynamic>> download(String id) async => asMap(
    await _client.request('/materials/$id/download', authenticated: true),
  );

  Future<Map<String, dynamic>> purchase(
    String id, {
    required int expectedListingVersion,
    required String idempotencyKey,
  }) => _json(
    '/materials/$id/purchase',
    'POST',
    {'expectedListingVersion': expectedListingVersion},
    headers: {'Idempotency-Key': idempotencyKey},
  );

  Future<List<Map<String, dynamic>>> orders() async => asList(
    await _client.request('/me/material-orders', authenticated: true),
    asMap,
  );

  Future<Map<String, dynamic>> _json(
    String path,
    String method,
    Map<String, Object?> body, {
    Map<String, String> headers = const {},
  }) async => asMap(
    await _client.request(
      path,
      method: method,
      body: body,
      headers: headers,
      authenticated: true,
    ),
  );
}
