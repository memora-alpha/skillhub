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

final _anchorProvider = Provider<DateTime>((ref) {
  ref.watch(sessionSnapshotProvider.select((s) => s.generation));
  return DateTime.now();
});

final sessionsProvider = Provider<List<PreviewSession>>((ref) {
  final paths = ref.watch(pathsProvider);
  final overrides = ref.watch(sessionOverridesProvider);
  final anchor = ref.watch(_anchorProvider);
  return [
    for (final path in paths)
      if (const ['ACTIVE', 'COMPLETED', 'DISPUTED'].contains(path.status))
        for (final plan in path.plans)
          for (final (i, slot) in (plan.schedule?.slots ?? const <Slot>[]).indexed)
            overrides['${plan.id}-$i'] ??
                _derive(path, plan, i, slot, anchor),
  ];
});

PreviewSession _derive(
  LearningPath path,
  Plan plan,
  int i,
  Slot slot,
  DateTime anchor,
) {
  final endedFixture =
      const ['path-active', 'path-awaiting'].contains(path.id) && i == 0;
  return PreviewSession(
    id: '${plan.id}-$i',
    pathId: path.id,
    planId: plan.id,
    title: '${plan.skill} · Buổi ${i + 1}: ${plan.outline[i]}',
    partner: path.partner,
    startAt: endedFixture
        ? anchor.subtract(const Duration(hours: 3))
        : slot.startAt,
    duration: slot.duration,
    mine: plan.teacher == 'me',
    status: switch (path.status) {
      'COMPLETED' => 'COMPLETED',
      'DISPUTED' => 'DISPUTED',
      _ => endedFixture ? 'AWAITING_CONFIRMATION' : 'CONFIRMED',
    },
    partnerConfirmed:
        (endedFixture && path.id == 'path-active') ||
        path.status == 'COMPLETED',
    meConfirmed: path.status == 'COMPLETED',
    change: path.id == 'path-active' && i == 1
        ? SessionChange(
            startAt: slot.startAt.add(const Duration(days: 1)),
            duration: 90,
            reason:
                'Đối tác đề nghị chuyển sang ngày kế tiếp trong kịch bản mẫu.',
            version: 1,
            meConfirmed: false,
            partnerConfirmed: true,
            requestedBy: 'partner',
          )
        : null,
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
