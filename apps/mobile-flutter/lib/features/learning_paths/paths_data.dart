import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/session/auth_session.dart';

const _unset = Object();

class Slot {
  const Slot({required this.startAt, required this.duration});

  final DateTime startAt;
  final int duration;

  DateTime get endAt => startAt.add(Duration(minutes: duration));
}

class PlanSchedule {
  const PlanSchedule({
    required this.version,
    required this.slots,
    this.meVersion,
    this.partnerVersion,
  });

  final int version;
  final List<Slot> slots;
  final int? meVersion;
  final int? partnerVersion;

  PlanSchedule copyWith({List<Slot>? slots, Object? meVersion = _unset}) =>
      PlanSchedule(
        version: version,
        slots: slots ?? this.slots,
        meVersion: meVersion == _unset ? this.meVersion : meVersion as int?,
        partnerVersion: partnerVersion,
      );
}

class Plan {
  const Plan({
    required this.id,
    required this.teacher,
    required this.learner,
    required this.skill,
    required this.goal,
    required this.outline,
    required this.version,
    this.learnerVersion,
    this.revision,
    this.schedule,
  });

  final String id;
  final String teacher;
  final String learner;
  final String skill;
  final String goal;
  final List<String> outline;
  final int version;
  final int? learnerVersion;
  final String? revision;
  final PlanSchedule? schedule;

  Plan copyWith({
    String? skill,
    String? goal,
    List<String>? outline,
    int? version,
    Object? learnerVersion = _unset,
    Object? revision = _unset,
    Object? schedule = _unset,
  }) => Plan(
    id: id,
    teacher: teacher,
    learner: learner,
    skill: skill ?? this.skill,
    goal: goal ?? this.goal,
    outline: outline ?? this.outline,
    version: version ?? this.version,
    learnerVersion: learnerVersion == _unset
        ? this.learnerVersion
        : learnerVersion as int?,
    revision: revision == _unset ? this.revision : revision as String?,
    schedule: schedule == _unset ? this.schedule : schedule as PlanSchedule?,
  );
}

typedef PathReview = ({int rating, String comment});
typedef PathCancellation = ({String actor, String reason, DateTime at});

class LearningPath {
  const LearningPath({
    required this.id,
    required this.title,
    required this.partner,
    required this.type,
    required this.credit,
    required this.version,
    required this.status,
    required this.plans,
    required this.completedSessions,
    this.conversationId,
    this.meVersion,
    this.partnerVersion,
    this.teacher,
    this.reviewed = false,
    this.review,
    this.cancellation,
  });

  final String id;
  final String title;
  final String partner;
  final String? conversationId;
  final String type;
  final String credit;
  final int version;
  final int? meVersion;
  final int? partnerVersion;
  final String status;
  final List<Plan> plans;
  final String? teacher;
  final int completedSessions;
  final bool reviewed;
  final PathReview? review;
  final PathCancellation? cancellation;

  int get totalSessions => plans.fold(0, (sum, p) => sum + p.outline.length);

  LearningPath copyWith({
    String? type,
    String? credit,
    int? version,
    Object? meVersion = _unset,
    Object? partnerVersion = _unset,
    String? status,
    List<Plan>? plans,
    Object? teacher = _unset,
    int? completedSessions,
    bool? reviewed,
    PathReview? review,
    PathCancellation? cancellation,
  }) => LearningPath(
    id: id,
    title: title,
    partner: partner,
    conversationId: conversationId,
    type: type ?? this.type,
    credit: credit ?? this.credit,
    version: version ?? this.version,
    meVersion: meVersion == _unset ? this.meVersion : meVersion as int?,
    partnerVersion: partnerVersion == _unset
        ? this.partnerVersion
        : partnerVersion as int?,
    status: status ?? this.status,
    plans: plans ?? this.plans,
    teacher: teacher == _unset ? this.teacher : teacher as String?,
    completedSessions: completedSessions ?? this.completedSessions,
    reviewed: reviewed ?? this.reviewed,
    review: review ?? this.review,
    cancellation: cancellation ?? this.cancellation,
  );
}

DateTime futureSlot(int days, [int hour = 19]) {
  final now = DateTime.now();
  return DateTime(now.year, now.month, now.day + days, hour);
}

List<Slot> _slots(List<int> days, int hour) => [
  for (final day in days) Slot(startAt: futureSlot(day, hour), duration: 90),
];

Plan _plan(String id, bool mine) => Plan(
  id: id,
  teacher: mine ? 'me' : 'partner',
  learner: mine ? 'partner' : 'me',
  skill: mine ? 'React' : 'UI/UX',
  goal: mine
      ? 'Tự xây dựng ứng dụng React với component và hook.'
      : 'Thiết kế giao diện sản phẩm theo quy trình UX.',
  outline: mine
      ? const ['Component và state', 'Hook và dự án thực hành']
      : const ['Nghiên cứu người dùng', 'Wireframe và prototype'],
  version: 1,
  learnerVersion: 1,
  schedule: PlanSchedule(
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    slots: _slots([1, 2], mine ? 19 : 15),
  ),
);

Plan _withSlots(Plan plan, List<Slot> slots) =>
    plan.copyWith(schedule: plan.schedule!.copyWith(slots: slots));

List<LearningPath> initialPaths() => [
  LearningPath(
    id: 'path-draft',
    title: 'React ↔ UI/UX',
    partner: 'Hồng Anh',
    type: 'TWO_WAY',
    credit: '40',
    version: 1,
    partnerVersion: 1,
    status: 'PROPOSED',
    plans: [
      for (final p in [_plan('draft-react', true), _plan('draft-ux', false)])
        p.copyWith(schedule: null),
    ],
    completedSessions: 0,
  ),
  LearningPath(
    id: 'path-ready',
    title: 'Trao đổi React và thiết kế',
    partner: 'Hồng Anh',
    type: 'TWO_WAY',
    credit: '40',
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: 'PROPOSED',
    plans: [_plan('ready-react', true), _plan('ready-ux', false)],
    completedSessions: 0,
  ),
  LearningPath(
    id: 'path-active',
    title: 'React thực hành',
    partner: 'Minh Khoa',
    type: 'ONE_WAY',
    teacher: 'partner',
    credit: '100',
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: 'ACTIVE',
    plans: [
      _withSlots(
        _plan('active-react', false).copyWith(
          skill: 'React',
          goal: 'Xây dựng một ứng dụng React hoàn chỉnh.',
          outline: const ['Component và state', 'Hook và dự án thực hành'],
        ),
        _slots([8, 9], 18),
      ),
    ],
    completedSessions: 0,
  ),
  LearningPath(
    id: 'path-completed',
    title: 'Tiếng Anh giao tiếp',
    partner: 'Hồng Anh',
    type: 'ONE_WAY',
    teacher: 'partner',
    credit: '100',
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: 'COMPLETED',
    plans: [
      _withSlots(
        _plan('completed-english', false).copyWith(
          skill: 'Tiếng Anh',
          goal: 'Tự tin giao tiếp trong công việc.',
          outline: const ['Hội thoại thực tế', 'Thuyết trình dự án'],
        ),
        _slots([-21, -14], 19),
      ),
    ],
    completedSessions: 2,
  ),
  LearningPath(
    id: 'path-disputed',
    title: 'Thực hành TypeScript',
    partner: 'Minh Khoa',
    type: 'TWO_WAY',
    credit: '40',
    version: 1,
    status: 'DISPUTED',
    plans: [
      for (final p in [_plan('disputed-ts', true), _plan('disputed-ux', false)])
        _withSlots(p, _slots([12, 13], p.teacher == 'me' ? 19 : 15)),
    ],
    completedSessions: 0,
  ),
  LearningPath(
    id: 'path-completed-two-way',
    title: 'Trao đổi React ↔ UI/UX đã hoàn tất',
    partner: 'Hồng Anh',
    type: 'TWO_WAY',
    credit: '40',
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: 'COMPLETED',
    completedSessions: 4,
    plans: [
      for (final p in [
        _plan('finished-react', true),
        _plan('finished-ux', false),
      ])
        _withSlots(p, [
          for (var i = 0; i < p.schedule!.slots.length; i++)
            Slot(
              startAt: futureSlot(-21 + i * 7, p.teacher == 'me' ? 19 : 15),
              duration: p.schedule!.slots[i].duration,
            ),
        ]),
    ],
  ),
  LearningPath(
    id: 'path-one-way-ready',
    title: 'Bạn dạy React một chiều',
    partner: 'Hồng Anh',
    type: 'ONE_WAY',
    teacher: 'me',
    credit: '10.50',
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: 'PROPOSED',
    plans: [_plan('oneway-ready-react', true)],
    completedSessions: 0,
  ),
  LearningPath(
    id: 'path-no-credit',
    title: 'Một chiều · thiếu số dư mẫu',
    partner: 'Hồng Anh',
    type: 'ONE_WAY',
    teacher: 'partner',
    credit: '200',
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: 'PROPOSED',
    plans: [_plan('nocredit-react', false)],
    completedSessions: 0,
  ),
  LearningPath(
    id: 'path-conflict',
    title: 'Hai chiều · lịch trùng mẫu',
    partner: 'Hồng Anh',
    type: 'TWO_WAY',
    credit: '40',
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: 'PROPOSED',
    plans: [
      _plan('conflict-react', true),
      _withSlots(_plan('conflict-ux', false), _slots([1, 2], 19)),
    ],
    completedSessions: 0,
  ),
  LearningPath(
    id: 'path-awaiting',
    title: 'Buổi học chờ đối tác xác nhận',
    partner: 'Hồng Anh',
    type: 'ONE_WAY',
    teacher: 'partner',
    credit: '40',
    version: 1,
    meVersion: 1,
    partnerVersion: 1,
    status: 'ACTIVE',
    plans: [_withSlots(_plan('awaiting-ux', false), _slots([16, 17], 18))],
    completedSessions: 0,
  ),
  LearningPath(
    id: 'path-pending-plan',
    title: 'Kế hoạch cần bạn xác nhận',
    partner: 'Hồng Anh',
    type: 'TWO_WAY',
    credit: '40',
    version: 1,
    partnerVersion: 1,
    status: 'PROPOSED',
    plans: [
      _plan('pending-react', true).copyWith(schedule: null),
      _plan(
        'pending-ux',
        false,
      ).copyWith(learnerVersion: null, schedule: null),
    ],
    completedSessions: 0,
  ),
];

bool plansConfirmed(LearningPath path) {
  final roles = path.type == 'TWO_WAY'
      ? path.plans.length == 2 &&
            path.plans.any((p) => p.teacher == 'me') &&
            path.plans.any((p) => p.teacher == 'partner')
      : path.plans.length == 1 && path.plans.first.teacher == path.teacher;
  return roles &&
      path.plans.every(
        (p) =>
            p.teacher != p.learner &&
            p.outline.isNotEmpty &&
            p.learnerVersion == p.version,
      );
}

bool agreementConfirmed(LearningPath path) =>
    plansConfirmed(path) &&
    path.meVersion == path.version &&
    path.partnerVersion == path.version;

LearningPath? editOwnPlan(
  LearningPath path,
  String planId, {
  required String skill,
  required String goal,
  required List<String> outline,
}) {
  final plan = path.plans.where((p) => p.id == planId).firstOrNull;
  if (plan == null || plan.teacher != 'me' || path.status != 'PROPOSED') {
    return null;
  }
  return path.copyWith(
    version: path.version + 1,
    meVersion: null,
    partnerVersion: null,
    plans: [
      for (final p in path.plans)
        p.id == planId
            ? p.copyWith(
                skill: skill,
                goal: goal,
                outline: outline,
                version: p.version + 1,
                learnerVersion: null,
                revision: null,
                schedule: null,
              )
            : p.copyWith(schedule: null),
    ],
  );
}

bool overlaps(Slot a, Slot b) =>
    a.startAt.isBefore(b.endAt) && a.endAt.isAfter(b.startAt);

bool hasConflict(List<Slot> slots) {
  final sorted = [...slots]..sort((a, b) => a.startAt.compareTo(b.startAt));
  for (var i = 1; i < sorted.length; i++) {
    if (sorted[i].startAt.isBefore(sorted[i - 1].endAt)) return true;
  }
  return false;
}

String? validSlots(List<Slot> slots, int count, [DateTime? now]) {
  final current = now ?? DateTime.now();
  if (slots.length != count) {
    return 'Lịch cần đúng $count buổi của kế hoạch này.';
  }
  if (slots.any((s) => !s.startAt.isAfter(current))) {
    return 'Chọn ngày giờ trong tương lai.';
  }
  if (slots.any((s) => s.duration < 60 || s.duration > 180)) {
    return 'Mỗi buổi kéo dài 60–180 phút.';
  }
  if (hasConflict(slots)) return 'Các buổi học bị trùng giờ.';
  return null;
}

String? finalValidation(
  LearningPath path, {
  required ({num me, num partner}) balances,
  DateTime? now,
  List<Slot> occupied = const [],
}) {
  if (path.status != 'PROPOSED') {
    return 'Lộ trình không còn ở trạng thái thương lượng.';
  }
  if (!agreementConfirmed(path)) {
    return 'Chưa đủ xác nhận kế hoạch và điều khoản cùng phiên bản.';
  }
  final credit = num.tryParse(path.credit) ?? 0;
  if (!RegExp(r'^\d{1,10}(\.\d{1,2})?$').hasMatch(path.credit) ||
      credit <= 0 ||
      (path.type == 'TWO_WAY' && credit < 20)) {
    return 'Credit chưa hợp lệ cho hình thức học.';
  }
  for (final plan in path.plans) {
    final schedule = plan.schedule;
    if (schedule == null ||
        schedule.meVersion != schedule.version ||
        schedule.partnerVersion != schedule.version) {
      return 'Cần hai bên xác nhận từng lịch cùng phiên bản.';
    }
    final error = validSlots(schedule.slots, plan.outline.length, now);
    if (error != null) return error;
  }
  final proposed = [for (final p in path.plans) ...?p.schedule?.slots];
  if (hasConflict(proposed)) return 'Lịch của hai kế hoạch bị trùng nhau.';
  if (proposed.any((slot) => occupied.any((busy) => overlaps(slot, busy)))) {
    return 'Lịch bị trùng với buổi học đã khóa của lộ trình khác.';
  }
  final payers = path.type == 'TWO_WAY'
      ? [balances.me, balances.partner]
      : [path.teacher == 'me' ? balances.partner : balances.me];
  if (payers.any((balance) => balance < credit)) {
    return 'Số dư mẫu không đủ để tạm giữ Credit.';
  }
  return null;
}

bool canReschedule(DateTime startAt, [DateTime? now]) =>
    startAt.difference(now ?? DateTime.now()).inMinutes >= 60;

class PathsNotifier extends Notifier<List<LearningPath>> {
  @override
  List<LearningPath> build() {
    ref.watch(sessionSnapshotProvider.select((s) => s.generation));
    return initialPaths();
  }

  LearningPath? find(String? id) =>
      state.where((p) => p.id == id).firstOrNull;

  void save(LearningPath path) =>
      state = [path, ...state.where((p) => p.id != path.id)];
}

final pathsProvider = NotifierProvider<PathsNotifier, List<LearningPath>>(
  PathsNotifier.new,
);
