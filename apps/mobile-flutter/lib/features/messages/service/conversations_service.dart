import 'package:dio/dio.dart';

import '../../../core/http/http_client.dart';
import '../api/conversations_api.dart';
import '../schema/conversation_schema.dart';

class ConversationsService {
  ConversationsService(HttpClient client) : _api = ConversationsApi(client);

  final ConversationsApi _api;

  Future<Page<ConversationRecord>> list({String? cursor, int? limit}) =>
      _api.list(cursor: cursor, limit: limit);

  Future<ConversationRecord> get(String id) => _api.get(id);

  Future<Page<MessageRecord>> messages(
    String id, {
    String? cursor,
    int? limit,
  }) => _api.messages(id, cursor: cursor, limit: limit);

  Future<MessageRecord> send(
    String id, {
    required String clientMessageId,
    required String messageText,
    required String idempotencyKey,
  }) => _api.send(
    id,
    clientMessageId: clientMessageId,
    messageText: messageText,
    idempotencyKey: idempotencyKey,
  );

  Future<void> markRead(String id, {required String messageId}) =>
      _api.markRead(id, messageId: messageId);

  Future<Map<String, dynamic>> upload(String id, FormData body) =>
      _api.upload(id, body);
}
