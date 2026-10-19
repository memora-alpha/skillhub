import '../../../core/http/http_client.dart';

class NotificationRecord {
  const NotificationRecord({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.readAt,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final String? readAt;
  final String createdAt;

  static NotificationRecord parse(Object? value) {
    final json = asMap(value);
    return NotificationRecord(
      id: asString(json['id']),
      type: asString(json['type']),
      title: asString(json['title']),
      body: asString(json['body']),
      readAt: asOptionalString(json['readAt']),
      createdAt: asString(json['createdAt']),
    );
  }
}
