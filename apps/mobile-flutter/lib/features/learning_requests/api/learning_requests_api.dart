import '../../../core/http/http_client.dart';
import '../schema/learning_request_schema.dart';

class LearningRequestsApi {
  LearningRequestsApi(this._client);

  final HttpClient _client;

  Future<Page<LearningRequestCard>> feed({String? cursor, int? limit}) =>
      _page('/learning-requests', cursor, limit);

  Future<Page<Map<String, dynamic>>> mine({String? cursor, int? limit}) async =>
      Page.parse(
        await _client.requestEnvelope(
          withQuery('/learning-requests/mine', {'cursor': cursor, 'limit': limit}),
          authenticated: true,
        ),
        asMap,
      );

  Future<Page<LearningRequestCard>> recommended({
    String? cursor,
    int? limit,
  }) => _page('/learning-requests/recommended', cursor, limit);

  Future<Map<String, dynamic>> get(String requestId) async => asMap(
    await _client.request('/learning-requests/$requestId', authenticated: true),
  );

  Future<Map<String, dynamic>> create(LearningRequestDraft draft) async =>
      asMap(
        await _client.request(
          '/learning-requests',
          method: 'POST',
          body: draft.toJson(),
          authenticated: true,
        ),
      );

  Future<Map<String, dynamic>> publish(
    String requestId, {
    required int expectedVersion,
  }) => _version('/learning-requests/$requestId/publish', expectedVersion);

  Future<Map<String, dynamic>> cancel(
    String requestId, {
    required int expectedVersion,
  }) => _version('/learning-requests/$requestId/cancel', expectedVersion);

  Future<Map<String, dynamic>> edit(
    String requestId,
    LearningRequestDraft draft, {
    required int expectedVersion,
  }) async => asMap(
    await _client.request(
      '/learning-requests/$requestId',
      method: 'PATCH',
      body: draft.toJson(expectedVersion: expectedVersion),
      authenticated: true,
    ),
  );

  Future<Page<LearningRequestCard>> _page(
    String path,
    String? cursor,
    int? limit,
  ) async => Page.parse(
    await _client.requestEnvelope(
      withQuery(path, {'cursor': cursor, 'limit': limit}),
      authenticated: true,
    ),
    LearningRequestCard.parse,
  );

  Future<Map<String, dynamic>> _version(String path, int expectedVersion) async =>
      asMap(
        await _client.request(
          path,
          method: 'POST',
          body: {'expectedVersion': expectedVersion},
          authenticated: true,
        ),
      );
}
