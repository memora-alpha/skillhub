import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session/auth_session.dart';
import '../learning_paths/paths_data.dart';

const _unset = Object();

class SessionChange {
  const SessionChange({
    required this.startAt,
    required this.duration,
    required this.reason,
    required this.version,
    required this.meConfirmed,
    required this.partnerConfirmed,
    this.requestedBy,
    this.applied = false,
  });

  final DateTime startAt;
  final int duration;
  final String reason;
  final int version;
  final bool meConfirmed;
  final bool partnerConfirmed;
  final String? requestedBy;
  final bool applied;

  SessionChange copyWith({bool? meConfirmed, bool? applied}) => SessionChange(
    startAt: startAt,
    duration: duration,
    reason: reason,
    version: version,
    meConfirmed: meConfirmed ?? this.meConfirmed,
    partnerConfirmed: partnerConfirmed,
    requestedBy: requestedBy,
    applied: applied ?? this.applied,
  );
}

class PreviewSession {
  const PreviewSession({
    required this.id,
    required this.pathId,
    required this.planId,
    required this.title,
    required this.partner,
    required this.startAt,
    required this.duration,
    required this.status,
    required this.mine,
    this.meConfirmed = false,
    this.partnerConfirmed = false,
    this.change,
  });

  final String id;
  final String pathId;
  final String planId;
  final String title;
  final String partner;
  final DateTime startAt;
  final int duration;
  final String status;
  final bool mine;
  final bool meConfirmed;
  final bool partnerConfirmed;
  final SessionChange? change;

  Slot get slot => Slot(startAt: startAt, duration: duration);
  DateTime get endAt => slot.endAt;

  PreviewSession copyWith({
    DateTime? startAt,
    int? duration,
    String? status,
    bool? meConfirmed,
    Object? change = _unset,
  }) => PreviewSession(
    id: id,
    pathId: pathId,
    planId: planId,
    title: title,
    partner: partner,
    startAt: startAt ?? this.startAt,
    duration: duration ?? this.duration,
    status: status ?? this.status,
    mine: mine,
    meConfirmed: meConfirmed ?? this.meConfirmed,
    partnerConfirmed: partnerConfirmed,
    change: change == _unset ? this.change : change as SessionChange?,
  );
}

class LiveSessionsNotifier extends Notifier<List<PreviewSession>> {
  var _ticket = 0;

  @override
  List<PreviewSession> build() {
    final phase = ref.watch(sessionSnapshotProvider).phase;
    final userId = ref.watch(accountProvider).value?.userId;
    if (phase == SessionPhase.ready && userId != null) {
      _ticket++;
      _load(_ticket, userId);
    }
    return const [];
  }

  Future<void> _load(int ticket, String me) async {
    try {
      final rows = await ref
          .read(authRuntimeProvider)
          .services
          .study
          .mySessions();
      if (!ref.mounted || ticket != _ticket) return;
      state = [
        for (final row in rows)
          if (row['id'] is String && row['startAt'] is String)
            _session(row, me),
      ];
    } catch (_) {
      if (!ref.mounted || ticket != _ticket) return;
      state = const [];
    }
  }
}

final liveSessionsProvider =
    NotifierProvider<LiveSessionsNotifier, List<PreviewSession>>(
      LiveSessionsNotifier.new,
    );

final sessionsProvider = Provider<List<PreviewSession>>((ref) {
  final live = ref.watch(liveSessionsProvider);
  final overrides = ref.watch(sessionOverridesProvider);
  return [for (final session in live) overrides[session.id] ?? session];
});

PreviewSession _session(Map<String, dynamic> row, String me) {
  final start = DateTime.parse(row['startAt'] as String).toLocal();
  final end = row['endAt'] is String
      ? DateTime.parse(row['endAt'] as String).toLocal()
      : start.add(const Duration(minutes: 60));
  final teacher = row['teacherId'] == me;
  final mineConfirmed = teacher
      ? row['teacherConfirmationStatus'] == 'CONFIRMED'
      : row['learnerConfirmationStatus'] == 'CONFIRMED';
  final partnerConfirmed = teacher
      ? row['learnerConfirmationStatus'] == 'CONFIRMED'
      : row['teacherConfirmationStatus'] == 'CONFIRMED';
  return PreviewSession(
    id: row['id'] as String,
    pathId: row['pathId']?.toString() ?? '',
    planId: row['planId']?.toString() ?? '',
    title: 'Buổi học',
    partner: teacher ? 'Người học' : 'Người dạy',
    startAt: start,
    duration: end.difference(start).inMinutes.clamp(1, 24 * 60),
    status: row['status']?.toString() ?? 'CONFIRMED',
    mine: teacher,
    meConfirmed: mineConfirmed,
    partnerConfirmed: partnerConfirmed,
  );
}

bool _blocks(PreviewSession other, String id, Slot slot) =>
    other.id != id &&
    const ['CONFIRMED', 'DISPUTED'].contains(other.status) &&
    overlaps(slot, other.slot);

/// Whether [slot] overlaps another locked session than [id].
bool slotTaken(List<PreviewSession> sessions, String id, Slot slot) =>
    sessions.any((other) => _blocks(other, id, slot));

class SessionOverridesNotifier extends Notifier<Map<String, PreviewSession>> {
  @override
  Map<String, PreviewSession> build() {
    ref.watch(sessionSnapshotProvider.select((s) => s.generation));
    return const {};
  }

  PreviewSession? _find(String id) =>
      ref.read(sessionsProvider).where((s) => s.id == id).firstOrNull;

  void save(PreviewSession session) =>
      state = {...state, session.id: session};

  void confirm(String id) {
    final session = _find(id);
    if (session == null ||
        session.meConfirmed ||
        session.status != 'AWAITING_CONFIRMATION' ||
        DateTime.now().isBefore(session.endAt)) {
      return;
    }
    final complete = session.partnerConfirmed;
    save(
      session.copyWith(
        meConfirmed: true,
        status: complete ? 'COMPLETED' : 'AWAITING_CONFIRMATION',
      ),
    );
    final paths = ref.read(pathsProvider.notifier);
    final path = paths.find(session.pathId);
    if (complete && path != null) {
      paths.save(path.copyWith(completedSessions: path.completedSessions + 1));
    }
  }

  String? confirmChange(String id) {
    final s = _find(id);
    final change = s?.change;
    if (s == null || change == null || change.applied || s.status != 'CONFIRMED') {
      return 'Đề nghị không còn hợp lệ.';
    }
    final now = DateTime.now();
    if (s.startAt.difference(now).inMilliseconds < 3600000) {
      return 'Đã qua hạn chốt đổi lịch; lịch cũ giữ nguyên.';
    }
    if (!change.startAt.isAfter(now)) {
      return 'Ngày giờ đề nghị không còn trong tương lai.';
    }
    if (slotTaken(
      ref.read(sessionsProvider),
      id,
      Slot(startAt: change.startAt, duration: change.duration),
    )) {
      return 'Lịch mới bị trùng buổi học khác; lịch cũ giữ nguyên.';
    }
    final confirmed = change.copyWith(meConfirmed: true);
    save(
      confirmed.partnerConfirmed
          ? s.copyWith(
              startAt: confirmed.startAt,
              duration: confirmed.duration,
              change: confirmed.copyWith(applied: true),
            )
          : s.copyWith(change: confirmed),
    );
    return null;
  }
}

final sessionOverridesProvider =
    NotifierProvider<SessionOverridesNotifier, Map<String, PreviewSession>>(
      SessionOverridesNotifier.new,
    );
