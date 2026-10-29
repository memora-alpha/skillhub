import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/http/app_error.dart';
import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';
import '../remote/remote_load.dart';
import '../skills/skills_feature.dart';
import 'schema/proposal_schema.dart';

const _unset = Object();

const proposalStatusLabels = {
  'PENDING': 'Chờ phản hồi',
  'ACCEPTED': 'Đã chấp nhận',
  'REJECTED': 'Đã từ chối',
  'WITHDRAWN': 'Đã rút',
  'EXPIRED': 'Đã hết hạn',
};

const closedProposalStatuses = ['REJECTED', 'WITHDRAWN', 'EXPIRED'];

class DemoProposal {
  const DemoProposal({
    required this.id,
    required this.direction,
    required this.sourceType,
    required this.requestTitle,
    required this.partnerId,
    required this.partner,
    required this.skill,
    required this.message,
    required this.credit,
    required this.sessions,
    required this.schedule,
    required this.time,
    required this.status,
    this.requestId,
    this.localDecisionNote,
    this.version = 1,
    this.conversationId,
  });

  final String id;
  final String direction;
  final String sourceType;
  final String? requestId;
  final String requestTitle;
  final String partnerId;
  final String partner;
  final String skill;
  final String message;
  final String credit;
  final int sessions;
  final String schedule;
  final String time;
  final String status;

  /// UI-only note; no backend rejection DTO is defined yet.
  final String? localDecisionNote;
  final int version;
  final String? conversationId;

  bool get sent => direction == 'sent';
  bool get closed => closedProposalStatuses.contains(status);

  DemoProposal copyWith({
    String? message,
    String? credit,
    int? sessions,
    String? schedule,
    String? time,
    String? status,
    Object? localDecisionNote = _unset,
  }) => DemoProposal(
    id: id,
    direction: direction,
    sourceType: sourceType,
    requestId: requestId,
    requestTitle: requestTitle,
    partnerId: partnerId,
    partner: partner,
    skill: skill,
    message: message ?? this.message,
    credit: credit ?? this.credit,
    sessions: sessions ?? this.sessions,
    schedule: schedule ?? this.schedule,
    time: time ?? this.time,
    status: status ?? this.status,
    localDecisionNote: localDecisionNote == _unset
        ? this.localDecisionNote
        : localDecisionNote as String?,
    version: version,
    conversationId: conversationId,
  );
}


String? validateProposalMessage(String value) {
  final length = value.trim().runes.length;
  return length < 10 || length > 1000
      ? 'Nhập lời giới thiệu từ 10 đến 1.000 ký tự.'
      : null;
}

String? validateProposalCredit(String value) {
  final text = value.trim();
  return RegExp(r'^\d{1,10}(?:\.\d{1,2})?$').hasMatch(text) &&
          num.parse(text) >= 20
      ? null
      : 'Nhập Credit từ 20, tối đa 10 chữ số nguyên và 2 chữ số thập phân.';
}

String? validateProposalSessions(String value) {
  final text = value.trim();
  final number = RegExp(r'^\d+$').hasMatch(text) ? int.tryParse(text) : null;
  return number != null && number >= 1
      ? null
      : 'Nhập số buổi nguyên lớn hơn hoặc bằng 1.';
}

String? validateRejectionNote(String value) {
  final text = value.trim();
  if (text.isEmpty) {
    return 'Nhập lý do từ chối để người gửi hiểu lựa chọn của bạn.';
  }
  return text.runes.length > 1000 ? 'Lý do không vượt quá 1.000 ký tự.' : null;
}

DemoProposal _proposalView(
  ProposalRecord record,
  String direction,
  String me,
  Map<String, String> skillNames,
  Map<String, String> names,
) {
  final partnerId = record.proposerId == me
      ? record.recipientId
      : record.proposerId;
  return DemoProposal(
    id: record.id,
    direction: direction,
    sourceType: record.sourceType,
    requestId: record.learningRequestId,
    requestTitle: record.learningRequestId ?? record.sourceType,
    partnerId: partnerId,
    partner: names[partnerId] ?? partnerId,
    skill: skillNames[record.skillId] ?? record.skillId,
    message: record.message,
    credit: record.proposedCredit ?? '',
    sessions: 0,
    schedule: record.expiresAt,
    time: record.expiresAt,
    status: record.status,
    version: record.version,
    conversationId: record.conversationId,
  );
}

class ProposalsNotifier extends Notifier<List<DemoProposal>> {
  var _ticket = 0;

  @override
  List<DemoProposal> build() {
    listenForRefresh(ref, RefreshScope.proposals, () {
      final me = ref.read(accountProvider).value?.userId;
      if (ref.read(sessionSnapshotProvider).phase != SessionPhase.ready) return;
      if (me == null) return;
      _reload(++_ticket, me);
    });
    final phase = ref.watch(sessionSnapshotProvider).phase;
    final userId = ref.watch(accountProvider).value?.userId;
    if (phase == SessionPhase.ready && userId != null) {
      _ticket++;
      _reload(_ticket, userId);
    }
    return const [];
  }

  Future<void> _reload(int ticket, String me) async {
    try {
      final api = ref.read(authRuntimeProvider).services.proposals;
      final received = await drainPages(
        (cursor) => api.list(direction: 'received', cursor: cursor, limit: 50),
      );
      final sent = await drainPages(
        (cursor) => api.list(direction: 'sent', cursor: cursor, limit: 50),
      );
      final catalog = await ref.read(skillCatalogProvider.future);
      final skillNames = {for (final skill in catalog) skill.id: skill.name};
      final partnerIds = {
        for (final record in [...received, ...sent])
          record.proposerId == me ? record.recipientId : record.proposerId,
      };
      final names = <String, String>{};
      await Future.wait([
        for (final id in partnerIds)
          () async {
            try {
              final profile = await ref
                  .read(authRuntimeProvider)
                  .account
                  .publicProfile(id);
              final name = profile['fullName'];
              if (name is String && name.isNotEmpty) names[id] = name;
            } catch (_) {}
          }(),
      ]);
      if (!ref.mounted || ticket != _ticket) return;
      state = [
        for (final record in received)
          _proposalView(record, 'received', me, skillNames, names),
        for (final record in sent)
          _proposalView(record, 'sent', me, skillNames, names),
      ];
    } catch (_) {
      if (!ref.mounted || ticket != _ticket) return;
      state = const [];
    }
  }

  DemoProposal? find(String? id) =>
      state.where((p) => p.id == id).firstOrNull;

  Future<String?> submit({
    required String sourceType,
    required String? requestId,
    required String requestTitle,
    required String partnerId,
    required String partner,
    required String skill,
    required String message,
    required String credit,
    required int sessions,
    required String schedule,
    String? recipientSharingSkillId,
    String? exchangeTypeHint,
  }) async {
    final me = ref.read(accountProvider).value?.userId;
    if (me == null) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    try {
      await ref.read(authRuntimeProvider).services.proposals.create(
        ProposalDraft(
          sourceType: sourceType,
          message: message.trim(),
          learningRequestId: requestId,
          recipientSharingSkillId: recipientSharingSkillId,
          exchangeTypeHint: exchangeTypeHint,
          proposedCredit: credit.trim(),
          initialSessionCount: sessions,
        ),
        idempotencyKey: newUuid(),
      );
      final ticket = ++_ticket;
      await _reload(ticket, me);
      return null;
    } catch (error) {
      if (error is AppError && error.code == 'PROPOSAL_ALREADY_PENDING') {
        return 'Đã có đề xuất đang chờ phản hồi. Bạn có thể xem hoặc rút đề xuất trong danh sách Đã gửi.';
      }
      if (error is AppError && error.code == 'INVALID_CREDIT_HINT') {
        return 'Credit gợi ý cho trao đổi hai chiều cần từ 20.';
      }
      if (error is AppError && error.code == 'TEACHER_SKILL_NOT_ELIGIBLE') {
        return 'Bạn chưa có đúng kỹ năng của yêu cầu này trên hồ sơ, hoặc kỹ năng đang lưu trữ.';
      }
      return errorMessage(error);
    }
  }

  Future<bool> update(
    String id, {
    required String message,
    required String credit,
    required String sessions,
    required String schedule,
  }) async {
    final item = find(id);
    if (ref.read(accountSessionProvider) == null ||
        item == null ||
        !item.sent ||
        item.status != 'PENDING' ||
        validateProposalMessage(message) != null ||
        validateProposalCredit(credit) != null ||
        validateProposalSessions(sessions) != null) {
      return false;
    }
    try {
      await ref.read(authRuntimeProvider).services.proposals.change(
        id,
        expectedVersion: item.version,
        idempotencyKey: newUuid(),
        message: message.trim(),
        proposedCredit: credit.trim(),
      );
      final me = ref.read(accountProvider).value?.userId;
      if (me == null) return false;
      final ticket = ++_ticket;
      await _reload(ticket, me);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// [status] is `ACCEPTED`, `REJECTED` or `WITHDRAWN`.
  Future<bool> decide(String id, String status, [String? localDecisionNote]) async {
    final item = find(id);
    final me = ref.read(accountProvider).value?.userId;
    if (me == null ||
        item == null ||
        item.status != 'PENDING' ||
        (status == 'WITHDRAWN' ? !item.sent : item.sent)) {
      return false;
    }
    try {
      final api = ref.read(authRuntimeProvider).services.proposals;
      final key = newUuid();
      if (status == 'ACCEPTED') {
        await api.accept(
          id,
          expectedVersion: item.version,
          idempotencyKey: key,
        );
      } else if (status == 'REJECTED') {
        await api.reject(
          id,
          expectedVersion: item.version,
          idempotencyKey: key,
        );
      } else if (status == 'WITHDRAWN') {
        await api.withdraw(
          id,
          expectedVersion: item.version,
          idempotencyKey: key,
        );
      } else {
        return false;
      }
      final ticket = ++_ticket;
      await _reload(ticket, me);
      return find(id)?.status == status;
    } catch (_) {
      return false;
    }
  }
}

final proposalsProvider =
    NotifierProvider<ProposalsNotifier, List<DemoProposal>>(
      ProposalsNotifier.new,
    );
