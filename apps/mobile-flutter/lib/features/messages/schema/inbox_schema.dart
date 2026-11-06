import '../../../core/http/app_error.dart';
import '../../../core/http/http_client.dart';

class InboxMessage {
  InboxMessage(this.conversationId, this.senderId, this.preview, this.sentAt);
  final String conversationId, senderId, preview, sentAt;
  static InboxMessage parse(Object? value) {
    final json = asMap(value);
    return InboxMessage(
      asString(json['conversationId']),
      asString(json['senderId']),
      asText(json['preview']),
      asString(json['sentAt']),
    );
  }
}

class InboxGroup {
  InboxGroup({
    required this.id,
    required this.groupType,
    required this.title,
    required this.learningRequestId,
    required this.conversationId,
    required this.viewerRole,
    required this.conversationCount,
    required this.receivedProposalCount,
    required this.sentProposalCount,
    required this.hasUnread,
    required this.latestMessage,
  });
  final String id, groupType, viewerRole;
  final String? title, learningRequestId, conversationId;
  final int conversationCount;
  final int? receivedProposalCount, sentProposalCount;
  final bool hasUnread;
  final InboxMessage? latestMessage;
  static InboxGroup parse(Object? value) {
    final json = asMap(value);
    final type = asString(json['groupType']);
    final request = asOptionalString(json['learningRequestId']);
    final conversation = asOptionalString(json['conversationId']);
    if (!['LEARNING_REQUEST', 'DIRECT_CONVERSATION'].contains(type) ||
        (type == 'LEARNING_REQUEST' ? request == null : conversation == null)) {
      throw const AppError.protocol();
    }
    int? count(String key) {
      if (json[key] == null) return null;
      final value = asInt(json[key]);
      if (value < 0) throw const AppError.protocol();
      return value;
    }

    return InboxGroup(
      id: asString(json['id']),
      groupType: type,
      title: asOptionalString(json['title']),
      learningRequestId: request,
      conversationId: conversation,
      viewerRole: asString(json['viewerRole']),
      conversationCount:
          count('conversationCount') ?? (throw const AppError.protocol()),
      receivedProposalCount: count('receivedProposalCount'),
      sentProposalCount: count('sentProposalCount'),
      hasUnread: asBool(json['hasUnread']),
      latestMessage: json['latestMessage'] == null
          ? null
          : InboxMessage.parse(json['latestMessage']),
    );
  }
}
