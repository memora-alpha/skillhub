import '../../../core/http/http_client.dart';
import '../schema/notification_schema.dart';

class NotificationsApi {
  NotificationsApi(this._client);

  final HttpClient _client;

  Future<Page<NotificationRecord>> list({
    String? cursor,
    int? limit,
    bool? unread,
  }) async => Page.parse(
    await _client.requestEnvelope(
      withQuery('/notifications', {
        'cursor': cursor,
        'limit': limit,
        'unread': unread,
      }),
      authenticated: true,
    ),
    NotificationRecord.parse,
  );

  Future<Map<String, dynamic>> registerPush(String token) async => asMap(
    await _client.request(
      '/notifications/push-tokens',
      method: 'POST',
      body: {'token': token},
      authenticated: true,
    ),
  );

  Future<void> unregisterPush(String tokenId) => _client.request(
    '/notifications/push-tokens/$tokenId',
    method: 'DELETE',
    authenticated: true,
  );

  Future<void> markRead(String notificationId) => _client.request(
    '/notifications/$notificationId/read',
    method: 'PATCH',
    authenticated: true,
  );
}
