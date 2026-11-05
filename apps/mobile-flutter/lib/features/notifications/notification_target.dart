import '../product_shell/schema/notification_schema.dart';

final _uuid = RegExp(
  r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
);

const _proposalTypes = {
  'proposal.created',
  'proposal.updated',
  'proposal.accepted',
  'proposal.rejected',
  'proposal.withdrawn',
  'proposal.expired',
};

const _sessionTypes = {
  'session.attendance.determined',
  'session.absence-excuse.submitted',
  'session.absence-excuse.decided',
  'session.no-show.finalized',
  'session.completed.timeout',
  'session.makeup.expired',
};

/// Payloads are references, never trusted URLs.
String? notificationTarget(NotificationRecord item) {
  final raw = item.payload;
  if (raw is! Map) return null;
  final payload = Map<String, dynamic>.from(raw);
  bool valid(String field) {
    final value = payload[field];
    return value is String && _uuid.hasMatch(value);
  }

  if (_sessionTypes.contains(item.type) && valid('sessionId')) {
    return '/learning-sessions/${payload['sessionId']}';
  }
  if (item.type == 'chat.message.delivered' && valid('conversationId')) {
    return '/chat/${payload['conversationId']}';
  }
  if (_proposalTypes.contains(item.type) && valid('proposalId')) {
    return '/proposal/${payload['proposalId']}';
  }
  if (item.type == 'LEARNING_REQUEST_REJECTED' && valid('requestId')) {
    return '/requests/${payload['requestId']}';
  }
  if ({'skill.verification.decided', 'skill.evidence.revoked'}.contains(
        item.type,
      ) &&
      valid('sharingSkillId') &&
      valid('verificationId')) {
    return '/skills/${payload['sharingSkillId']}/verifications/${payload['verificationId']}';
  }
  if ({'learning-path.locked', 'learning-path.settled'}.contains(item.type) &&
      valid('pathId')) {
    return '/paths/${payload['pathId']}';
  }
  return null;
}
