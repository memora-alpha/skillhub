import 'package:dio/dio.dart';

import '../../../core/http/app_error.dart';
import '../../../core/http/http_client.dart';
import '../schema/conversation_schema.dart';
import '../schema/inbox_schema.dart';

class ConversationsApi {
  ConversationsApi(this._client);

  final HttpClient _client;

  Future<Page<InboxGroup>> inbox({String? cursor, int limit = 20}) async =>
      Page.parse(
        await _client.requestEnvelope(
          withQuery('/conversations/inbox', {'cursor': cursor, 'limit': limit}),
          authenticated: true,
        ),
        InboxGroup.parse,
      );

  Future<Page<ConversationRecord>> list({
    String? cursor,
    int? limit,
    String? learningRequestId,
  }) async => Page.parse(
    await _client.requestEnvelope(
      withQuery('/conversations', {
        'cursor': cursor,
        'limit': limit,
        'learningRequestId': learningRequestId,
      }),
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
    String? afterSequence,
    int? limit,
  }) async {
    if (cursor != null && afterSequence != null) {
      throw const AppError.protocol();
    }
    return Page.parse(
      await _client.requestEnvelope(
        withQuery('/conversations/$id/messages', {
          'cursor': cursor,
          'afterSequence': afterSequence,
          'limit': limit,
        }),
        authenticated: true,
      ),
      MessageRecord.parse,
    );
  }

  Future<MessageRecord> send(
    String id, {
    required String clientMessageId,
    String messageText = '',
    List<String> attachmentFileIds = const [],
    required String idempotencyKey,
  }) async {
    final body = <String, Object?>{
      'clientMessageId': clientMessageId,
      if (messageText.isNotEmpty) 'messageText': messageText,
      if (attachmentFileIds.isNotEmpty) 'attachmentFileIds': attachmentFileIds,
    };
    final json = asMap(
      await _client.request(
        '/conversations/$id/messages',
        method: 'POST',
        body: body,
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

  Future<Map<String, dynamic>> upload(String id, FormData body) async => asMap(
    await _client.request(
      '/conversations/$id/attachments',
      method: 'POST',
      body: body,
      authenticated: true,
    ),
  );
}
