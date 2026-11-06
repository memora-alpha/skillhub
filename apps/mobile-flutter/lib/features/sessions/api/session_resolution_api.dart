import '../../../core/http/app_error.dart';
import '../../../core/http/http_client.dart';

/// Absence and cancellation are separate commands from incident reports.
class SessionResolutionApi {
  SessionResolutionApi(this.client);
  final HttpClient client;
  String _session(String id) => '/sessions/${Uri.encodeComponent(id)}';

  Future<Map<String, dynamic>> excuse(String id, String reason) {
    final text = reason.trim();
    if (text.length < 10 || text.length > 1000) throw const AppError.protocol();
    return _post('${_session(id)}/absence-excuse', {'reason': text});
  }

  Future<Map<String, dynamic>> decideExcuse(String id, bool accept) => _post(
    '${_session(id)}/absence-excuse/decision',
    {'accept': accept, 'note': ''},
  );

  Map<String, dynamic> _change(Object? value, String id) {
    final row = asMap(value);
    if (row['sessionId'] != id ||
        row['kind'] != 'SESSION_CANCELLATION' ||
        row['id'] is! String ||
        row['version'] is! int) {
      throw const AppError.protocol();
    }
    return row;
  }

  Future<List<Map<String, dynamic>>> cancellations(String id) async => asList(
    await client.request(
      '${_session(id)}/cancellation-requests',
      authenticated: true,
    ),
    (value) => _change(value, id),
  );

  Future<Map<String, dynamic>> cancel(
    String id,
    String reason,
    String startAt,
    String key,
  ) async {
    if (reason.trim().length < 3 ||
        reason.trim().length > 1000 ||
        DateTime.tryParse(startAt) == null ||
        key.isEmpty)
      throw const AppError.protocol();
    return _change(
      await _post(
        '${_session(id)}/cancellation-requests',
        {'reason': reason.trim(), 'expectedStartAt': startAt},
        headers: {'Idempotency-Key': key},
      ),
      id,
    );
  }

  Future<Map<String, dynamic>> respond(
    String id,
    String requestId,
    int version, {
    bool? accept,
  }) async {
    if (version < 1) throw const AppError.protocol();
    final action = accept == null ? 'withdraw' : 'response';
    final row = _change(
      await _post(
        '${_session(id)}/cancellation-requests/${Uri.encodeComponent(requestId)}/$action',
        {
          'expectedVersion': version,
          if (accept != null) ...{'accept': accept, 'note': ''},
        },
      ),
      id,
    );
    if (row['id'] != requestId) throw const AppError.protocol();
    return row;
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, Object?> body, {
    Map<String, String> headers = const {},
  }) async => asMap(
    await client.request(
      path,
      method: 'POST',
      body: body,
      headers: headers,
      authenticated: true,
    ),
  );
}
