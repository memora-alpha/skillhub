import '../../../core/http/http_client.dart';
import '../api/learning_requests_api.dart';
import '../schema/learning_request_schema.dart';

class LearningRequestsService {
  LearningRequestsService(HttpClient client) : _api = LearningRequestsApi(client);

  final LearningRequestsApi _api;

  Future<Page<LearningRequestCard>> feed({String? cursor, int? limit}) =>
      _api.feed(cursor: cursor, limit: limit);

  Future<Page<Map<String, dynamic>>> mine({String? cursor, int? limit}) =>
      _api.mine(cursor: cursor, limit: limit);

  Future<Page<LearningRequestCard>> recommended({String? cursor, int? limit}) =>
      _api.recommended(cursor: cursor, limit: limit);

  Future<Map<String, dynamic>> get(String requestId) => _api.get(requestId);

  Future<Map<String, dynamic>> create(LearningRequestDraft draft) =>
      _api.create(draft);

  Future<Map<String, dynamic>> publish(
    String requestId, {
    required int expectedVersion,
  }) => _api.publish(requestId, expectedVersion: expectedVersion);

  Future<Map<String, dynamic>> cancel(
    String requestId, {
    required int expectedVersion,
  }) => _api.cancel(requestId, expectedVersion: expectedVersion);

  Future<Map<String, dynamic>> edit(
    String requestId,
    LearningRequestDraft draft, {
    required int expectedVersion,
  }) => _api.edit(requestId, draft, expectedVersion: expectedVersion);
}
