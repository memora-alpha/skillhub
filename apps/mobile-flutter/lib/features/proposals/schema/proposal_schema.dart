import '../../../core/http/http_client.dart';

class ProposalSlot {
  const ProposalSlot({required this.startAt, required this.endAt});

  final String startAt;
  final String endAt;

  static ProposalSlot parse(Object? value) {
    final json = asMap(value);
    return ProposalSlot(
      startAt: asString(json['startAt']),
      endAt: asString(json['endAt']),
    );
  }

  Map<String, String> toJson() => {'startAt': startAt, 'endAt': endAt};
}

class ProposalRecord {
  const ProposalRecord({
    required this.id,
    required this.sourceType,
    required this.learningRequestId,
    required this.proposerId,
    required this.recipientId,
    required this.skillId,
    required this.message,
    required this.exchangeTypeHint,
    required this.proposedCredit,
    required this.status,
    required this.version,
    required this.expiresAt,
    required this.conversationId,
  });

  final String id;
  final String sourceType;
  final String? learningRequestId;
  final String proposerId;
  final String recipientId;
  final String skillId;
  final String message;
  final String? exchangeTypeHint;
  final String? proposedCredit;
  final String status;
  final int version;
  final String expiresAt;
  final String? conversationId;

  static ProposalRecord parse(Object? value) {
    final json = asMap(value);
    return ProposalRecord(
      id: asString(json['id']),
      sourceType: asString(json['sourceType']),
      learningRequestId: asOptionalString(json['learningRequestId']),
      proposerId: asString(json['proposerId']),
      recipientId: asString(json['recipientId']),
      skillId: asString(json['skillId']),
      message: asString(json['message']),
      exchangeTypeHint: asOptionalString(json['exchangeTypeHint']),
      proposedCredit: asOptionalString(json['proposedCredit']),
      status: asString(json['status']),
      version: asInt(json['version']),
      expiresAt: asString(json['expiresAt']),
      conversationId: asOptionalString(json['conversationId']),
    );
  }
}

class ProposalDraft {
  const ProposalDraft({
    required this.sourceType,
    required this.message,
    this.learningRequestId,
    this.recipientSharingSkillId,
    this.exchangeTypeHint,
    this.proposedCredit,
    this.proposedDurationMinutes,
    this.initialSessionCount,
    this.candidateSlots = const [],
  });

  final String sourceType;
  final String message;
  final String? learningRequestId;
  final String? recipientSharingSkillId;
  final String? exchangeTypeHint;
  final String? proposedCredit;
  final int? proposedDurationMinutes;
  final int? initialSessionCount;
  final List<ProposalSlot> candidateSlots;

  Map<String, Object?> toJson() => {
    'sourceType': sourceType,
    'message': message,
    'learningRequestId': ?learningRequestId,
    'recipientSharingSkillId': ?recipientSharingSkillId,
    'exchangeTypeHint': ?exchangeTypeHint,
    'proposedCredit': ?proposedCredit,
    'proposedDurationMinutes': ?proposedDurationMinutes,
    'initialSessionCount': ?initialSessionCount,
    if (candidateSlots.isNotEmpty)
      'candidateSlots': [for (final slot in candidateSlots) slot.toJson()],
  };
}
