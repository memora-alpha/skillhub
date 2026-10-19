import '../../../core/http/http_client.dart';

/// Learning paths, schedules, sessions, reviews and reports.
/// Responses stay JSON objects because each route returns a different view.
class StudyApi {
  StudyApi(this._client);

  final HttpClient _client;

  Future<Map<String, dynamic>> createPath(Map<String, Object?> body) =>
      _json('/learning-paths', 'POST', body);

  Future<Map<String, dynamic>> revisePath(
    String pathId,
    Map<String, Object?> body,
  ) => _json('/learning-paths/$pathId', 'PATCH', body);

  Future<Map<String, dynamic>> validatePath(String pathId) =>
      _json('/learning-paths/$pathId/final-validation', 'POST', const {});

  Future<Map<String, dynamic>> finalizePath(
    String pathId, {
    required int expectedVersion,
  }) => _json('/learning-paths/$pathId/finalize', 'POST', {
    'expectedVersion': expectedVersion,
  });

  Future<Map<String, dynamic>> addPlan(
    String pathId,
    Map<String, Object?> body,
  ) => _json('/learning-paths/$pathId/plans', 'POST', body);

  Future<Map<String, dynamic>> confirmPath(
    String pathId, {
    required int expectedVersion,
  }) => _json('/learning-paths/$pathId/confirm', 'POST', {
    'expectedVersion': expectedVersion,
  });

  Future<Map<String, dynamic>> confirmPlan(
    String planId, {
    required int expectedVersion,
  }) => _json('/learning-paths/plans/$planId/confirm', 'POST', {
    'expectedVersion': expectedVersion,
  });

  Future<Map<String, dynamic>> revisePlan(
    String planId,
    Map<String, Object?> body,
  ) => _json('/learning-paths/plans/$planId', 'PATCH', body);

  Future<Map<String, dynamic>> proposeSchedule(
    String planId,
    Map<String, Object?> body,
  ) => _json('/learning-plans/$planId/schedule-proposals', 'POST', body);

  Future<Map<String, dynamic>> confirmSchedule(
    String scheduleId,
    Map<String, Object?> body,
  ) => _json('/schedule-proposals/$scheduleId/confirm', 'POST', body);

  Future<Map<String, dynamic>> reschedule(
    String sessionId,
    Map<String, Object?> body,
  ) => _json('/sessions/$sessionId/reschedule-proposals', 'POST', body);

  Future<List<Map<String, dynamic>>> mySessions({
    String? from,
    String? to,
  }) async => asList(
    await _client.request(
      withQuery('/sessions/mine', {'from': from, 'to': to}),
      authenticated: true,
    ),
    asMap,
  );

  Future<Map<String, dynamic>> session(String sessionId) async => asMap(
    await _client.request('/sessions/$sessionId', authenticated: true),
  );

  Future<Map<String, dynamic>> settle(String pathId) =>
      _json('/sessions/paths/$pathId/settlement', 'POST', const {});

  Future<Map<String, dynamic>> confirmCompletion(
    String sessionId,
    Map<String, Object?> body,
  ) => _json('/sessions/$sessionId/confirm-completion', 'POST', body);

  Future<Map<String, dynamic>> createReview(
    String pathId,
    Map<String, Object?> body,
  ) => _json('/learning-paths/$pathId/reviews', 'POST', body);

  Future<List<Map<String, dynamic>>> reviews(String pathId) async => asList(
    await _client.request(
      '/learning-paths/$pathId/reviews',
      authenticated: true,
    ),
    asMap,
  );

  Future<Map<String, dynamic>> reputation({String? cursor}) async => asMap(
    await _client.request(
      withQuery('/reputation/me', {'cursor': cursor}),
      authenticated: true,
    ),
  );

  Future<Object?> achievements() =>
      _client.request('/me/achievements', authenticated: true);

  Future<Map<String, dynamic>> selectTitle(String? code) =>
      _json('/me/achievements/selected-title', 'PATCH', {'code': ?code});

  Future<List<Map<String, dynamic>>> myReports() async => asList(
    await _client.request('/reports/mine', authenticated: true),
    asMap,
  );

  Future<Map<String, dynamic>> reportSession(
    String sessionId,
    Map<String, Object?> body,
  ) => _json('/reports/sessions/$sessionId', 'POST', body);

  Future<Map<String, dynamic>> _json(
    String path,
    String method,
    Map<String, Object?> body,
  ) async => asMap(
    await _client.request(
      path,
      method: method,
      body: body,
      authenticated: true,
    ),
  );
}
