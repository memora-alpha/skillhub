import 'package:dio/dio.dart';

import '../../../core/http/http_client.dart';
import '../schema/conversation_schema.dart';

class ConversationsApi {
  ConversationsApi(this._client);

  final HttpClient _client;

  Future<Page<ConversationRecord>> list({String? cursor, int? limit}) async =>
      Page.parse(
        await _client.requestEnvelope(
          withQuery('/conversations', {'cursor': cursor, 'limit': limit}),
          authenticated: true,
        ),
        ConversationRecord.parse,
      );

  Future<ConversationRecord> get(String id) async => ConversationRecord.parse(
    await _client.request('/conversations/$id', authenticated: true),
  );

  Future<Page<MessageRecord>> messages(
    String id, {
    String? cursor,
    int? limit,
  }) async => Page.parse(
    await _client.requestEnvelope(
      withQuery('/conversations/$id/messages', {
        'cursor': cursor,
        'limit': limit,
      }),
      authenticated: true,
    ),
    MessageRecord.parse,
  );

  Future<MessageRecord> send(
    String id, {
    required String clientMessageId,
    required String messageText,
    required String idempotencyKey,
  }) async {
    final json = asMap(
      await _client.request(
        '/conversations/$id/messages',
        method: 'POST',
        body: {'clientMessageId': clientMessageId, 'messageText': messageText},
        headers: {'Idempotency-Key': idempotencyKey},
        authenticated: true,
      ),
    );
    return MessageRecord.parse(json['message'] ?? json);
  }

  Future<void> markRead(String id, {required String messageId}) =>
      _client.request(
        '/conversations/$id/read',
        method: 'POST',
        body: {'messageId': messageId},
        authenticated: true,
      );

  Future<Map<String, dynamic>> delivery(
    String id,
    String clientMessageId,
  ) async => asMap(
    await _client.request(
      '/conversations/$id/message-deliveries/$clientMessageId',
      authenticated: true,
    ),
  );

  Future<Map<String, dynamic>> attachmentStatus(
    String id,
    String fileId,
  ) async => asMap(
    await _client.request(
      '/conversations/$id/attachments/$fileId/status',
      authenticated: true,
    ),
  );

  Future<Map<String, dynamic>> attachmentDownload(
    String id,
    String messageId,
    String attachmentId,
  ) async => asMap(
    await _client.request(
      '/conversations/$id/messages/$messageId/attachments/$attachmentId/download',
      authenticated: true,
    ),
  );

  Future<Map<String, dynamic>> upload(String id, FormData body) async =>
      asMap(
        await _client.request(
          '/conversations/$id/attachments',
          method: 'POST',
          body: body,
          authenticated: true,
        ),
      );
}
