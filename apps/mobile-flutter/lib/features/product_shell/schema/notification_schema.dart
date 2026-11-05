import '../../../core/http/http_client.dart';

class NotificationRecord {
  const NotificationRecord({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.payload,
    required this.readAt,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final Object? payload;
  final String? readAt;
  final String createdAt;

  bool get unread => readAt == null;

  NotificationRecord markRead([String? at]) => NotificationRecord(
    id: id,
    type: type,
    title: title,
    body: body,
    payload: payload,
    readAt: at ?? DateTime.now().toUtc().toIso8601String(),
    createdAt: createdAt,
  );

  static NotificationRecord parse(Object? value) {
    final json = asMap(value);
    return NotificationRecord(
      id: asString(json['id']),
      type: asString(json['type']),
      title: asString(json['title']),
      body: asString(json['body']),
      payload: json['payload'],
      readAt: asOptionalString(json['readAt']),
      createdAt: asString(json['createdAt']),
    );
  }
}
