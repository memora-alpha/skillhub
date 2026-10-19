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

  Future<void> markRead(String notificationId) => _client.request(
    '/notifications/$notificationId/read',
    method: 'PATCH',
    authenticated: true,
  );
}
