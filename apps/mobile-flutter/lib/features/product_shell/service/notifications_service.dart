import '../../../core/http/http_client.dart';
import '../api/notifications_api.dart';
import '../schema/notification_schema.dart';

class NotificationsService {
  NotificationsService(HttpClient client) : _api = NotificationsApi(client);

  final NotificationsApi _api;

  Future<Page<NotificationRecord>> list({
    String? cursor,
    int? limit,
    bool? unread,
  }) => _api.list(cursor: cursor, limit: limit, unread: unread);

  Future<void> markRead(String notificationId) => _api.markRead(notificationId);
}
