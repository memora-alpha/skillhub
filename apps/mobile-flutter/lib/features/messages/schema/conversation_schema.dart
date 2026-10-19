import '../../../core/http/http_client.dart';

class ConversationRecord {
  const ConversationRecord({
    required this.id,
    required this.proposalId,
    required this.learningRequestId,
    required this.participantAId,
    required this.participantBId,
    required this.createdAt,
  });

  final String id;
  final String proposalId;
  final String? learningRequestId;
  final String participantAId;
  final String participantBId;
  final String createdAt;

  static ConversationRecord parse(Object? value) {
    final json = asMap(value);
    return ConversationRecord(
      id: asString(json['id']),
      proposalId: asString(json['proposalId']),
      learningRequestId: asOptionalString(json['learningRequestId']),
      participantAId: asString(json['participantAId']),
      participantBId: asString(json['participantBId']),
      createdAt: asString(json['createdAt']),
    );
  }
}

class MessageAttachment {
  const MessageAttachment({
    required this.attachmentId,
    required this.fileId,
    required this.filename,
    required this.mimeType,
    required this.fileSizeBytes,
    required this.downloadUrlEndpoint,
  });

  final String attachmentId;
  final String fileId;
  final String filename;
  final String mimeType;
  final int fileSizeBytes;
  final String downloadUrlEndpoint;

  static MessageAttachment parse(Object? value) {
    final json = asMap(value);
    return MessageAttachment(
      attachmentId: asString(json['attachmentId']),
      fileId: asString(json['fileId']),
      filename: asString(json['filename']),
      mimeType: asString(json['mimeType']),
      fileSizeBytes: asInt(json['fileSizeBytes']),
      downloadUrlEndpoint: asString(json['downloadUrlEndpoint']),
    );
  }
}

class MessageRecord {
  const MessageRecord({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.messageText,
    required this.messageType,
    required this.attachments,
    required this.sequence,
    required this.sentAt,
    required this.readAt,
  });

  final String id;
  final String conversationId;
  final String senderId;
  final String messageText;
  final String messageType;
  final List<MessageAttachment> attachments;
  final String sequence;
  final String sentAt;
  final String? readAt;

  static MessageRecord parse(Object? value) {
    final json = asMap(value);
    return MessageRecord(
      id: asString(json['id']),
      conversationId: asString(json['conversationId']),
      senderId: asString(json['senderId']),
      messageText: asText(json['messageText']),
      messageType: asString(json['messageType']),
      attachments: asList(json['attachments'], MessageAttachment.parse),
      sequence: asString(json['sequence']),
      sentAt: asString(json['sentAt']),
      readAt: asOptionalString(json['readAt']),
    );
  }
}
