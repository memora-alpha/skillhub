import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/app_input.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../components/tappable.dart';
import '../../core/http/app_error.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';
import '../remote/remote_load.dart';
import '../messages/messages_data.dart';
import '../skills/schema/skill_schema.dart';
import '../skills/skills_feature.dart';
import 'negotiation_card.dart';
import 'negotiation_message.dart';
import 'plan_suggestion_draft.dart';
import 'schedule_slot_row.dart';
import 'schedule_timeline.dart';
import 'schedule_weekly_generator.dart';
import 'session_outline_editor.dart';
import 'weekly_schedule.dart';

final _uuid = RegExp(
  r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
);

bool isLiveId(String id) => _uuid.hasMatch(id);

const _editable = {'PROPOSED', 'PARTIALLY_CONFIRMED', 'CONFIRMED'};
const _planConfirmStatuses = {'PROPOSED', 'PARTIALLY_CONFIRMED'};

const _statusLabel = {
  'DRAFT': 'Bản nháp',
  'PROPOSED': 'Đang thương lượng',
  'PARTIALLY_CONFIRMED': 'Đang xác nhận',
  'CONFIRMED': 'Đã xác nhận kế hoạch và điều khoản',
  'SCHEDULED': 'Đã chốt lịch',
  'ACTIVE': 'Đang học',
  'COMPLETED': 'Đã hoàn thành',
  'CANCELLED': 'Đã hủy',
  'DISPUTED': 'Đang tranh chấp',
};

const _scheduleStatusLabel = {
  'DRAFT': 'Bản nháp',
  'PROPOSED': 'Đang thống nhất',
  'PARTIALLY_CONFIRMED': 'Chờ đủ xác nhận',
  'LOCKED': 'Đã khóa',
  'NEEDS_REVISION': 'Cần điều chỉnh',
  'CANCELLED': 'Đã hủy',
  'EXPIRED': 'Đã hết hạn',
};

const _sessionStatusLabel = {
  'CONFIRMED': 'Đã lên lịch',
  'READY': 'Sẵn sàng',
  'ONGOING': 'Đang diễn ra',
  'AWAITING_CONFIRMATION': 'Chờ xác nhận hoàn thành',
  'COMPLETED': 'Đã hoàn thành',
  'CANCELLED': 'Đã hủy',
  'DISPUTED': 'Đang tranh chấp',
};

List<Map<String, dynamic>> _lastLivePaths = const [];
final Map<String, Map<String, dynamic>> _lastLivePathById = {};

final livePathsProvider = FutureProvider<List<Map<String, dynamic>>>((
  ref,
) async {
  watchRefresh(ref, RefreshScope.study);
  if (ref.watch(sessionSnapshotProvider).phase != SessionPhase.ready) {
    return const [];
  }
  try {
    final next = await ref.read(authRuntimeProvider).services.study.myPaths();
    _lastLivePaths = next;
    return next;
  } catch (error) {
    if (isTransientReadError(error)) return _lastLivePaths;
    rethrow;
  }
});

final livePathProvider = FutureProvider.family<Map<String, dynamic>, String>((
  ref,
  id,
) async {
  watchRefresh(ref, RefreshScope.study);
  if (ref.watch(sessionSnapshotProvider).phase != SessionPhase.ready ||
      !isLiveId(id)) {
    return const {};
  }
  try {
    final next = await ref.read(authRuntimeProvider).services.study.path(id);
    _lastLivePathById[id] = next;
    return next;
  } catch (error) {
    if (isTransientReadError(error)) {
      return _lastLivePathById[id] ?? const {};
    }
    rethrow;
  }
});

Map<String, dynamic> _record(Object? value) =>
    value is Map ? Map<String, dynamic>.from(value) : const {};

List<Map<String, dynamic>> _records(Object? value) => [
  for (final item in value is List ? value : const []) _record(item),
];

int _version(Object? value) {
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse('$value') ?? 0;
}

String _text(Object? value) => value == null ? '' : '$value';

String _partnerName(WidgetRef ref, String userId) {
  for (final item in ref.watch(messagesProvider).conversations) {
    if (item.userId == userId) return item.name;
  }
  return 'Lộ trình cùng đối tác';
}

String _exchangeLabel(String? type) {
  if (type == 'TWO_WAY') return 'Trao đổi hai chiều';
  if (type == 'ONE_WAY') return 'Học một chiều';
  return 'Chưa có hình thức học';
}

bool _editablePath(Map<String, dynamic> path) =>
    path['lockedVersion'] == null && _editable.contains(path['status']);

bool _isParticipant(Map<String, dynamic> path, String me) =>
    me.isNotEmpty &&
    (path['participantAId'] == me || path['participantBId'] == me);

Map<String, dynamic>? _scheduleOf(Map<String, dynamic> plan) {
  final value = plan['schedule'];
  if (value is Map) return Map<String, dynamic>.from(value);
  return null;
}

bool _confirmedBy(Map<String, dynamic> path, Map<String, dynamic> value, String me) {
  if (!_isParticipant(path, me)) return false;
  final field = path['participantAId'] == me
      ? 'participantAConfirmedAt'
      : 'participantBConfirmedAt';
  return value[field] != null;
}

bool _schedulingReady(
  Map<String, dynamic> path,
  Map<String, dynamic> plan,
  String me,
) =>
    _editablePath(path) &&
    path['status'] == 'CONFIRMED' &&
    plan['teacherId'] == me &&
    plan['status'] == 'CONFIRMED' &&
    plan['learnerConfirmedAt'] != null;

bool _canSchedule(
  Map<String, dynamic> path,
  Map<String, dynamic> plan,
  String me,
) => _schedulingReady(path, plan, me) && plan['schedule'] == null;

bool _canEditSchedule(
  Map<String, dynamic> path,
  Map<String, dynamic> plan,
  String me,
) {
  final schedule = _scheduleOf(plan);
  if (schedule == null) return false;
  return _schedulingReady(path, plan, me) &&
      schedule['appliedVersion'] == null &&
      const {'DRAFT', 'PROPOSED', 'PARTIALLY_CONFIRMED', 'NEEDS_REVISION'}
          .contains(schedule['status']);
}

bool _canConfirmSchedule(
  Map<String, dynamic> path,
  Map<String, dynamic> plan,
  String me,
) {
  final schedule = _scheduleOf(plan);
  if (schedule == null) return false;
  return _isParticipant(path, me) &&
      _editablePath(path) &&
      path['status'] == 'CONFIRMED' &&
      const {'PROPOSED', 'PARTIALLY_CONFIRMED'}.contains(schedule['status']) &&
      !_confirmedBy(path, schedule, me);
}

bool _canFinalize(Map<String, dynamic> path) {
  if (!_editablePath(path) || path['status'] != 'CONFIRMED') return false;
  final agreement = _record(path['agreement']);
  if (agreement['participantAConfirmedAt'] == null ||
      agreement['participantBConfirmedAt'] == null) {
    return false;
  }
  final plans = _records(path['plans']);
  final twoWay = agreement['exchangeType'] == 'TWO_WAY';
  final directions = twoWay
      ? plans.length == 2 &&
            plans.any(
              (plan) =>
                  plan['teacherId'] == path['participantAId'] &&
                  plan['learnerId'] == path['participantBId'],
            ) &&
            plans.any(
              (plan) =>
                  plan['teacherId'] == path['participantBId'] &&
                  plan['learnerId'] == path['participantAId'],
            )
      : plans.length == 1 &&
            plans.first['teacherId'] == agreement['teacherId'] &&
            plans.first['learnerId'] == agreement['learnerId'];
  if (!directions) return false;
  return plans.every((plan) {
    final schedule = _scheduleOf(plan);
    if (schedule == null) return false;
    return plan['status'] == 'CONFIRMED' &&
        plan['learnerConfirmedAt'] != null &&
        const {'PROPOSED', 'PARTIALLY_CONFIRMED'}.contains(schedule['status']) &&
        schedule['participantAConfirmedAt'] != null &&
        schedule['participantBConfirmedAt'] != null &&
        _records(schedule['items']).length == _version(plan['totalSessions']);
  });
}

bool _rangesOverlap(DateTime aStart, DateTime aEnd, DateTime bStart, DateTime bEnd) =>
    aStart.isBefore(bEnd) && bStart.isBefore(aEnd);

/// Same rules as API `validateItems` + optional sibling proposal busy ranges.
String? scheduleSlotError(
  List<DateTime> starts,
  List<int> minutes, {
  List<({DateTime start, DateTime end, String label})> external = const [],
}) {
  final now = DateTime.now();
  DateTime? previousEnd;
  for (var i = 0; i < starts.length; i++) {
    final start = starts[i];
    final end = start.add(Duration(minutes: minutes[i]));
    if (!start.isAfter(now)) return 'Buổi ${i + 1} phải ở tương lai.';
    if (previousEnd != null && start.isBefore(previousEnd)) {
      return 'Buổi ${i + 1} trùng hoặc trước khi buổi $i kết thúc.';
    }
    previousEnd = end;
  }
  for (var i = 0; i < starts.length; i++) {
    final aStart = starts[i];
    final aEnd = aStart.add(Duration(minutes: minutes[i]));
    for (var j = i + 1; j < starts.length; j++) {
      final bStart = starts[j];
      final bEnd = bStart.add(Duration(minutes: minutes[j]));
      if (_rangesOverlap(aStart, aEnd, bStart, bEnd)) {
        return 'Buổi ${i + 1} trùng giờ với buổi ${j + 1}.';
      }
    }
    for (final busy in external) {
      if (_rangesOverlap(aStart, aEnd, busy.start, busy.end)) {
        return 'Buổi ${i + 1} trùng với ${busy.label}.';
      }
    }
  }
  return null;
}

/// Overlap message for one slot against the rest (and external busy ranges).
String? scheduleSlotConflictAt(
  int index,
  List<DateTime?> starts,
  List<int?> minutes, {
  List<({DateTime start, DateTime end, String label})> external = const [],
}) {
  final start = starts[index];
  final minute = minutes[index];
  if (start == null || minute == null) return null;
  final end = start.add(Duration(minutes: minute));
  if (!start.isAfter(DateTime.now())) return 'Buổi ${index + 1} phải ở tương lai.';
  for (var j = 0; j < starts.length; j++) {
    if (j == index) continue;
    final otherStart = starts[j];
    final otherMinutes = minutes[j];
    if (otherStart == null || otherMinutes == null) continue;
    final otherEnd = otherStart.add(Duration(minutes: otherMinutes));
    if (_rangesOverlap(start, end, otherStart, otherEnd)) {
      return 'Trùng giờ với buổi ${j + 1}.';
    }
  }
  for (final busy in external) {
    if (_rangesOverlap(start, end, busy.start, busy.end)) {
      return 'Trùng với ${busy.label}.';
    }
  }
  for (var j = index - 1; j >= 0; j--) {
    final prevStart = starts[j];
    final prevMinutes = minutes[j];
    if (prevStart == null || prevMinutes == null) continue;
    final prevEnd = prevStart.add(Duration(minutes: prevMinutes));
    if (start.isBefore(prevEnd)) {
      return 'Phải bắt đầu từ lúc buổi ${j + 1} kết thúc trở đi.';
    }
    break;
  }
  for (var j = index + 1; j < starts.length; j++) {
    final nextStart = starts[j];
    final nextMinutes = minutes[j];
    if (nextStart == null || nextMinutes == null) continue;
    if (nextStart.isBefore(end)) {
      return 'Kết thúc sau giờ bắt đầu buổi ${j + 1}.';
    }
    break;
  }
  return null;
}

bool _pathStillOpen(Object? status) =>
    status != 'COMPLETED' && status != 'CANCELLED';

/// True while a peer confirmation can still change the path detail status.
bool _awaitingPeerConfirmation(
  Map<String, dynamic> path,
  String me,
) {
  if (path.isEmpty || !_isParticipant(path, me) || !_pathStillOpen(path['status'])) {
    return false;
  }
  final agreement = _record(path['agreement']);
  if (_editablePath(path) &&
      agreement.isNotEmpty &&
      (agreement['participantAConfirmedAt'] == null ||
          agreement['participantBConfirmedAt'] == null)) {
    return true;
  }
  final plans = _records(path['plans']);
  if (_editablePath(path) &&
      plans.any((plan) => plan['learnerConfirmedAt'] == null)) {
    return true;
  }
  for (final plan in plans) {
    final schedule = _scheduleOf(plan);
    if (schedule == null) continue;
    if (schedule['participantAConfirmedAt'] == null ||
        schedule['participantBConfirmedAt'] == null) {
      return true;
    }
  }
  return false;
}

class LivePathsPage extends ConsumerWidget {
  const LivePathsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paths = ref.watch(livePathsProvider);
    final items = paths.value ?? const <Map<String, dynamic>>[];
    return FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.study}),
      title: 'Lộ trình của tôi',
      back: '/calendar',
      subtitle: 'Mỗi lần học là một bước tiến cùng nhau.',
      children: [
        WaitingRefresh(
          scopes: const {RefreshScope.study},
          enabled: items.any((path) => _pathStillOpen(path['status'])),
          child: const SizedBox.shrink(),
        ),
        if (paths.isLoading && !paths.hasValue)
          const LiveBusyNote(label: 'Đang tải lộ trình.'),
        if (paths.hasError)
          FormNotice(
            tone: NoticeTone.error,
            message: errorMessage(paths.error),
          ),
        if (paths.hasError)
          AppButton(
            label: 'Tải lại',
            variant: ButtonVariant.paper,
            onPressed: () => ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.study}),
          ),
        for (final path in paths.value ?? const <Map<String, dynamic>>[])
          Panel(
            title: _partnerName(ref, _text(path['counterpartId'])),
            children: [
              Copy(
                '${_statusLabel[path['status']] ?? path['status']} · v${path['currentVersion']}',
              ),
              Copy(_exchangeLabel(path['exchangeType']?.toString())),
              AppButton(
                label: 'Mở lộ trình',
                variant: ButtonVariant.paper,
                onPressed: () => context.go('/paths/${path['id']}'),
              ),
            ],
          ),
        if (paths.hasValue && paths.value!.isEmpty)
          const EmptyState(
            title: 'Chưa có lộ trình',
            description:
                'Mở cuộc trò chuyện sau khi đề xuất được chấp nhận để cùng tạo lộ trình học.',
          ),
        const RouteButton(href: '/messages', label: 'Đến cuộc trao đổi'),
      ],
    );
  }
}

class LiveAgreementScreen extends ConsumerStatefulWidget {
  const LiveAgreementScreen({
    super.key,
    required this.conversationId,
    required this.partnerId,
    required this.partnerName,
  });

  final String conversationId;
  final String partnerId;
  final String partnerName;

  @override
  ConsumerState<LiveAgreementScreen> createState() =>
      _LiveAgreementScreenState();
}

class _LiveAgreementScreenState extends ConsumerState<LiveAgreementScreen> {
  String _type = 'TWO_WAY';
  String _role = 'Tôi dạy';
  String _credit = '20';
  var _appliedSuggestion = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(messagesProvider.notifier).ensureOpen(widget.conversationId);
      final draft = ref.read(planSuggestionDraftProvider);
      if (draft != null && draft.conversationId == widget.conversationId) {
        setState(() {
          _type = draft.twoWay ? 'TWO_WAY' : 'ONE_WAY';
          _role = draft.teach ? 'Tôi dạy' : 'Tôi học';
          _credit = draft.credit;
          _appliedSuggestion = true;
        });
      }
    });
  }

  PathNegotiationSuggestion? _latestSuggestion() {
    final messages = ref.watch(messagesProvider);
    final thread = messages.threads[widget.conversationId] ?? const [];
    for (final message in thread.reversed) {
      final parsed = readNegotiationMessage(message.text);
      if (parsed != null) return parsed;
    }
    for (final item in messages.previews) {
      if (item.id != widget.conversationId) continue;
      return readNegotiationMessage(item.last);
    }
    return null;
  }

  void _applySuggestion(PathNegotiationSuggestion suggestion) {
    setState(() {
      _type = suggestion.twoWay ? 'TWO_WAY' : 'ONE_WAY';
      _role = suggestion.teach ? 'Tôi dạy' : 'Tôi học';
      _credit = suggestion.credit.isEmpty ? '20' : suggestion.credit;
      _appliedSuggestion = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(accountSessionProvider)?.userId ?? '';
    final paths = ref.watch(livePathsProvider);
    final suggestion = _latestSuggestion();
    final mine = [
      for (final path in paths.value ?? const <Map<String, dynamic>>[])
        if (path['conversationId'] == widget.conversationId) path,
    ];
    final twoWay = _type == 'TWO_WAY';
    return FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.study}),
      title: 'Lộ trình học',
      back: '/messages',
      children: [
        if (paths.isLoading && !paths.hasValue)
          const LiveBusyNote(label: 'Đang tải lộ trình của cuộc trao đổi này.'),
        if (paths.hasError && !isTransientReadError(paths.error))
          FormNotice(
            tone: NoticeTone.error,
            message: errorMessage(paths.error),
          ),
        for (final path in mine)
          Panel(
            title: widget.partnerName,
            children: [
              Copy(
                '${_statusLabel[path['status']] ?? path['status']} · v${path['currentVersion']}',
              ),
              Copy(_exchangeLabel(path['exchangeType']?.toString())),
              AppButton(
                label: 'Mở lộ trình',
                onPressed: () => context.go('/paths/${path['id']}'),
              ),
            ],
          ),
        if (paths.hasValue && mine.isEmpty && suggestion != null)
          NegotiationInboxPanel(
            suggestion: suggestion,
            onApply: () => _applySuggestion(suggestion),
            onOpenChat: () => context.push('/chat/${widget.conversationId}'),
          ),
        if (paths.hasValue && mine.isEmpty)
          Panel(
            title: 'Thống nhất lộ trình chính thức',
            children: [
              if (_appliedSuggestion)
                const FormNotice(
                  tone: NoticeTone.success,
                  message:
                      'Đã áp dụng gợi ý từ Chat. Kiểm tra rồi bấm Tạo lộ trình.',
                ),
              ChoiceGroup(
                label: 'Hình thức',
                value: twoWay ? 'Trao đổi hai chiều' : 'Học một chiều',
                options: const ['Trao đổi hai chiều', 'Học một chiều'],
                onChange: (value) => setState(
                  () => _type = value == 'Trao đổi hai chiều'
                      ? 'TWO_WAY'
                      : 'ONE_WAY',
                ),
              ),
              if (!twoWay)
                ChoiceGroup(
                  label: 'Vai trò của bạn',
                  value: _role,
                  options: const ['Tôi dạy', 'Tôi học'],
                  onChange: (value) => setState(() => _role = value),
                ),
              DataForm(
                key: ValueKey('$_type$_credit$_appliedSuggestion'),
                defaults: {'credit': _credit},
                fields: [
                  DataField(
                    name: 'credit',
                    label: twoWay
                        ? 'Credit cam kết mỗi người'
                        : 'Credit cho toàn lộ trình',
                    rule: creditRule(twoWay ? 20 : 0, twoWay),
                    numeric: true,
                  ),
                ],
                submitLabel: 'Tạo lộ trình',
                onSubmit: (values) async {
                  if (me.isEmpty) return 'Phiên đăng nhập chưa sẵn sàng.';
                  final teacher = _role == 'Tôi dạy' ? me : widget.partnerId;
                  final learner = _role == 'Tôi dạy' ? widget.partnerId : me;
                  try {
                    final created = await ref
                        .read(authRuntimeProvider)
                        .services
                        .study
                        .createPath(
                          twoWay
                              ? {
                                  'conversationId': widget.conversationId,
                                  'exchangeType': 'TWO_WAY',
                                  'totalCreditPerUser': values['credit'],
                                }
                              : {
                                  'conversationId': widget.conversationId,
                                  'exchangeType': 'ONE_WAY',
                                  'teacherId': teacher,
                                  'learnerId': learner,
                                  'negotiatedCredit': values['credit'],
                                },
                        );
                    ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.study});
                    final id = created['id']?.toString() ?? '';
                    if (id.isNotEmpty && context.mounted) {
                      final draft = ref.read(planSuggestionDraftProvider);
                      final openPlan = draft != null &&
                          draft.conversationId == widget.conversationId &&
                          draft.sessions.isNotEmpty &&
                          (twoWay || _role == 'Tôi dạy');
                      context.go(
                        openPlan ? '/paths/$id/plans/new' : '/paths/$id',
                      );
                    }
                    return null;
                  } catch (error) {
                    return errorMessage(error);
                  }
                },
              ),
              Copy(
                twoWay
                    ? 'Mỗi người tự tạo kế hoạch mình dạy; người học xác nhận từng kế hoạch.'
                    : 'Người dạy tạo kế hoạch; chỉ người học tạm giữ Credit khi chốt lịch.',
                muted: true,
              ),
            ],
          ),
        _PathSuggestionPanel(
          conversationId: widget.conversationId,
          partnerName: widget.partnerName,
          twoWay: twoWay,
          role: _role,
          credit: _credit,
          termsEditableAbove: paths.hasValue && mine.isEmpty,
        ),
      ],
    );
  }
}

class _PathSuggestionPanel extends ConsumerStatefulWidget {
  const _PathSuggestionPanel({
    required this.conversationId,
    required this.partnerName,
    required this.twoWay,
    required this.role,
    required this.credit,
    required this.termsEditableAbove,
  });

  final String conversationId;
  final String partnerName;
  /// Exchange / role / credit come from the official form above (or parent
  /// defaults) so this panel does not duplicate those controls.
  final bool twoWay;
  final String role;
  final String credit;
  final bool termsEditableAbove;

  @override
  ConsumerState<_PathSuggestionPanel> createState() =>
      _PathSuggestionPanelState();
}

class _PathSuggestionPanelState extends ConsumerState<_PathSuggestionPanel> {
  var _saved = false;
  var _sent = false;
  var _busy = false;
  String? _error;
  final _outline = SessionOutlineController(minTitleLength: 5);

  @override
  void dispose() {
    _outline.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final twoWay = widget.twoWay;
    final role = widget.role;
    final credit = widget.credit.isEmpty ? '20' : widget.credit;
    final exchangeLabel = twoWay ? 'Trao đổi hai chiều' : 'Học một chiều';
    return Panel(
      title: 'Cùng ${widget.partnerName} thiết kế cách học',
      children: [
        FormNotice(
          tone: NoticeTone.info,
          message: widget.termsEditableAbove
              ? 'Hình thức và Credit chỉnh ở phần “Thống nhất lộ trình chính thức” phía trên. Tại đây chỉ soạn kỹ năng, mục tiêu và buổi học rồi gửi Chat.'
              : 'Bạn có thể lưu ý tưởng và gửi gợi ý qua Chat. Hình thức/Credit lấy theo lựa chọn hiện tại của bạn.',
        ),
        const Copy(
          'Gợi ý dưới đây chưa tạo kế hoạch chính thức, chưa xác nhận điều khoản hoặc giữ Credit.',
          muted: true,
        ),
        Copy(
          twoWay
              ? '$exchangeLabel · $credit CR mỗi người'
              : '$exchangeLabel · $credit CR · $role',
          muted: true,
        ),
        if (_sent) ...[
          const FormNotice(
            tone: NoticeTone.success,
            message:
                'Đã gửi gợi ý vào Chat. Đây mới là thương lượng — chưa tạo lộ trình và chưa giữ Credit.',
          ),
          const Copy(
            'Bước tiếp theo: mở Chat để đối phương xem, rồi tạo lộ trình chính thức ở phần phía trên.',
            muted: true,
          ),
          AppButton(
            label: 'Mở Chat xem gợi ý',
            variant: ButtonVariant.craft,
            onPressed: () => context.push('/chat/${widget.conversationId}'),
          ),
          AppButton(
            label: 'Chỉnh và gửi lại',
            variant: ButtonVariant.paper,
            onPressed: () => setState(() {
              _sent = false;
              _error = null;
            }),
          ),
        ] else
          DataForm(
            key: ValueKey('$twoWay$role$credit'),
            defaults: const {
              'skill': '',
              'goal': '',
            },
            fields: [
              DataField(
                name: 'skill',
                label: twoWay || role == 'Tôi dạy'
                    ? 'Kỹ năng bạn muốn dạy'
                    : 'Kỹ năng muốn học',
                rule: textRule(1, 100),
              ),
              DataField(
                name: 'goal',
                label: 'Mục tiêu học',
                rule: textRule(10, 500),
                multiline: true,
              ),
            ],
            submitLabel: _busy ? 'Đang gửi...' : 'Gửi gợi ý qua Chat',
            extra: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 16,
              children: [
                SessionOutlineEditor(
                  controller: _outline,
                  label: 'Nội dung dự kiến từng buổi',
                  enabled: !_busy,
                  helper:
                      'Mỗi mốc là một buổi. Dùng để thương lượng, chưa tạo lộ trình chính thức.',
                ),
                if (_saved)
                  const FormNotice(
                    tone: NoticeTone.success,
                    message:
                        'Đã lưu bản nháp trong phiên này. Tiếp theo hãy gửi gợi ý qua Chat.',
                  ),
                if (_error != null)
                  FormNotice(tone: NoticeTone.error, message: _error!),
                Align(
                  alignment: Alignment.centerLeft,
                  child: AppButton(
                    label: 'Lưu bản nháp',
                    variant: ButtonVariant.ghost,
                    size: ButtonSize.sm,
                    disabled: _busy,
                    onPressed: () => setState(() {
                      _saved = true;
                      _error = null;
                    }),
                  ),
                ),
              ],
            ),
            onSubmit: (values) async {
              final outlineError = _outline.validate();
              if (outlineError != null) {
                setState(() => _error = outlineError);
                return outlineError;
              }
              final payload = {
                ...values,
                'outline': [
                  for (final content in _outline.contents)
                    sessionContentParts(content).title,
                ].join('\n'),
              };
              setState(() {
                _busy = true;
                _error = null;
                _saved = true;
              });
              try {
                final id = newUuid();
                await ref.read(authRuntimeProvider).services.conversations.send(
                  widget.conversationId,
                  clientMessageId: id,
                  messageText: formatNegotiationMessage(
                    twoWay: twoWay,
                    role: role,
                    skill: payload['skill'] ?? '',
                    goal: payload['goal'] ?? '',
                    credit: credit,
                    lessons: [
                      for (final line in (payload['outline'] ?? '').split('\n'))
                        if (line.trim().isNotEmpty) line.trim(),
                    ],
                  ),
                  idempotencyKey: id,
                );
                ref
                    .read(refreshTicksProvider.notifier)
                    .bump(const {RefreshScope.messages});
                if (mounted) setState(() => _sent = true);
                return null;
              } catch (error) {
                return errorMessage(error);
              } finally {
                if (mounted) setState(() => _busy = false);
              }
            },
          ),
      ],
    );
  }
}

class LivePathDetail extends ConsumerStatefulWidget {
  const LivePathDetail({super.key, required this.id});

  final String id;

  @override
  ConsumerState<LivePathDetail> createState() => _LivePathDetailState();
}

class _LivePathDetailState extends ConsumerState<LivePathDetail> {
  String? _error;
  String? _busy;
  String? _settlementGross;
  String? _settlementFee;

  Future<void> _run(String action, Future<void> Function() work) async {
    if (_busy != null) return;
    setState(() {
      _busy = action;
      _error = null;
    });
    try {
      await work();
      ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.study});
    } catch (error) {
      setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(livePathProvider(widget.id));
    final path = query.value ?? const <String, dynamic>{};
    final me = ref.watch(accountSessionProvider)?.userId ?? '';
    final agreement = _record(path['agreement']);
    final plans = _records(path['plans']);
    final catalog = ref.watch(skillCatalogProvider).value ?? const <SkillRecord>[];
    final editable = path.isNotEmpty && _editablePath(path);
    final mineIsA = path['participantAId'] == me;
    final confirmedByMe = _confirmedBy(path, agreement, me);
    final partnerConfirmed =
        (mineIsA
            ? agreement['participantBConfirmedAt']
            : agreement['participantAConfirmedAt']) !=
        null;
    final conversationId = _text(path['conversationId']);
    final canConfirm =
        editable &&
        me.isNotEmpty &&
        !confirmedByMe &&
        (path['participantAId'] == me || path['participantBId'] == me);
    final taught = plans.any((plan) => plan['teacherId'] == me);
    final canCreate =
        editable &&
        me.isNotEmpty &&
        !taught &&
        (path['participantAId'] == me || path['participantBId'] == me) &&
        (agreement['exchangeType'] == 'TWO_WAY' ||
            agreement['teacherId'] == me);
    final other = path['participantAId'] == me
        ? path['participantBId']
        : path['participantAId'];
    final credit =
        agreement['totalCreditPerUser'] ?? agreement['negotiatedCredit'];
    return FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.study}),
      title: 'Không gian lộ trình',
      back: '/paths',
      children: [
        WaitingRefresh(
          scopes: const {RefreshScope.study},
          interval: const Duration(seconds: 5),
          enabled: _awaitingPeerConfirmation(path, me),
          child: const SizedBox.shrink(),
        ),
        if (query.isLoading && path.isEmpty)
          const LiveBusyNote(label: 'Đang tải lộ trình.'),
        if (query.hasError && path.isEmpty)
          FormNotice(
            tone: NoticeTone.error,
            message: errorMessage(query.error),
          ),
        if (query.hasValue && path.isEmpty)
          const EmptyState(
            title: 'Không tìm thấy lộ trình',
            description: 'Lộ trình không còn trên máy chủ hoặc bạn không tham gia.',
          ),
        if (path.isNotEmpty) ...[
          Panel(
            title: _partnerName(ref, _text(other)),
            accent: true,
            children: [
              Copy(
                '${_statusLabel[path['status']] ?? path['status']} · ${_exchangeLabel(agreement['exchangeType']?.toString())} · v${path['currentVersion']}',
              ),
              if (credit != null) Copy('$credit CR'),
              if (path['lockedVersion'] != null)
                Copy(
                  'Đã khóa phiên bản ${path['lockedVersion']}. Các buổi học bên dưới được tải từ hệ thống.',
                ),
              const Copy(
                'Mỗi người tự tạo kế hoạch mình dạy. Người học của kế hoạch đó bấm xác nhận. Cả hai cùng xác nhận điều khoản của phiên bản hiện tại.',
                muted: true,
              ),
            ],
          ),
          for (final plan in plans)
            Panel(
              title: _skillName(catalog, _text(plan['skillId'])),
              children: [
                Copy(
                  plan['teacherId'] == me
                      ? 'Bạn dạy · ${_text(plan['learnerId']) == other ? _partnerName(ref, _text(other)) : 'Người học'} học'
                      : '${_partnerName(ref, _text(plan['teacherId']))} dạy · Bạn học',
                ),
                Copy(
                  plan['learnerConfirmedAt'] == null
                      ? 'Người học chưa xác nhận kế hoạch v${plan['version']}'
                      : 'Người học đã xác nhận kế hoạch v${plan['version']}',
                  muted: true,
                ),
                AppButton(
                  label: 'Xem kế hoạch',
                  variant: ButtonVariant.paper,
                  onPressed: () =>
                      context.go('/paths/${widget.id}/plans/${plan['id']}'),
                ),
                if (editable &&
                    _planConfirmStatuses.contains(path['status']) &&
                    plan['learnerId'] == me &&
                    plan['learnerConfirmedAt'] == null)
                  AppButton(
                    label: 'Xác nhận kế hoạch',
                    loading: _busy == plan['id'],
                    disabled: _busy != null,
                    onPressed: () => _run('${plan['id']}', () async {
                      await ref
                          .read(authRuntimeProvider)
                          .services
                          .study
                          .confirmPlan(
                            _text(plan['id']),
                            expectedVersion: _version(plan['version']),
                          );
                    }),
                  ),
              ],
            ),
          if (canCreate)
            AppButton(
              label: 'Tạo kế hoạch tôi dạy',
              onPressed: () => context.go('/paths/${widget.id}/plans/new'),
            ),
          Panel(
            title: 'Điều khoản v${agreement['version'] ?? path['currentVersion']}',
            children: [
              Copy(
                'Bạn: ${confirmedByMe ? 'đã xác nhận' : 'chưa xác nhận'} · Đối tác: ${partnerConfirmed ? 'đã xác nhận' : 'chưa xác nhận'}',
              ),
              const Copy(
                'Điều khoản và từng kế hoạch có xác nhận riêng. Tin nhắn không thay thế xác nhận.',
                muted: true,
              ),
              if (_error != null)
                FormNotice(tone: NoticeTone.error, message: _error!),
              if (canConfirm)
                AppButton(
                  label:
                      'Xác nhận điều khoản v${path['currentVersion']}',
                  variant: ButtonVariant.craft,
                  loading: _busy == 'terms',
                  disabled: _busy != null,
                  onPressed: () => _run('terms', () async {
                    await ref
                        .read(authRuntimeProvider)
                        .services
                        .study
                        .confirmPath(
                          widget.id,
                          expectedVersion: _version(path['currentVersion']),
                        );
                  }),
                ),
              if (editable)
                AppButton(
                  label: 'Sửa điều khoản',
                  variant: ButtonVariant.paper,
                  onPressed: () => context.go('/paths/${widget.id}/terms'),
                ),
            ],
          ),
          AppButton(
            label: 'Lịch của từng kế hoạch',
            variant: ButtonVariant.paper,
            onPressed: () => context.go('/paths/${widget.id}/schedules'),
          ),
          if (_settlementGross != null)
            FormNotice(
              tone: NoticeTone.success,
              message:
                  'Đã quyết toán. Tổng $_settlementGross CR, phí $_settlementFee CR.',
            ),
          if (path['status'] == 'ACTIVE')
            AppButton(
              label: _busy == 'settle' ? 'Đang quyết toán...' : 'Quyết toán lộ trình',
              variant: ButtonVariant.craft,
              loading: _busy == 'settle',
              disabled: _busy != null,
              onPressed: () => _run('settle', () async {
                final result = await ref
                    .read(authRuntimeProvider)
                    .services
                    .study
                    .settle(widget.id);
                await ref.read(accountProvider.notifier).reload();
                ref.read(refreshTicksProvider.notifier).bump(const {
                  RefreshScope.profile,
                });
                if (!mounted) return;
                setState(() {
                  _settlementGross = _text(result['gross']);
                  _settlementFee = _text(result['fee']);
                });
              }),
            ),
          if (path['status'] == 'COMPLETED' && path['settledAt'] != null)
            const Copy('Lộ trình đã được quyết toán.'),
          if (editable)
            AppButton(
              label: 'Kiểm tra và chốt lịch',
              variant: ButtonVariant.paper,
              onPressed: () => context.go('/paths/${widget.id}/hold'),
            ),
          AppButton(
            label: 'Trao đổi qua Chat',
            variant: ButtonVariant.paper,
            onPressed: () => context.go(
              conversationId.isEmpty ? '/messages' : '/chat/$conversationId',
            ),
          ),
        ],
      ],
    );
  }
}

class LivePlanPage extends ConsumerStatefulWidget {
  const LivePlanPage({super.key, required this.id, required this.planId});

  final String id;
  final String planId;

  @override
  ConsumerState<LivePlanPage> createState() => _LivePlanPageState();
}

class _LivePlanPageState extends ConsumerState<LivePlanPage> {
  String? _error;
  var _busy = false;

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(livePathProvider(widget.id));
    final path = query.value ?? const <String, dynamic>{};
    final me = ref.watch(accountSessionProvider)?.userId ?? '';
    final plan = _records(path['plans']).where((item) {
      return item['id'] == widget.planId;
    }).firstOrNull;
    final catalog = ref.watch(skillCatalogProvider).value ?? const <SkillRecord>[];
    final outline = _records(plan?['sessionOutline']);
    final editable = path.isNotEmpty && _editablePath(path);
    final canConfirm =
        plan != null &&
        editable &&
        _planConfirmStatuses.contains(path['status']) &&
        plan['learnerId'] == me &&
        plan['learnerConfirmedAt'] == null;
    return FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.study}),
      title: 'Kế hoạch học tập',
      back: '/paths/${widget.id}',
      children: [
        if (query.isLoading && plan == null)
          const LiveBusyNote(label: 'Đang tải kế hoạch.'),
        if (query.hasError && plan == null)
          FormNotice(
            tone: NoticeTone.error,
            message: errorMessage(query.error),
          ),
        if (query.hasValue && plan == null)
          const EmptyState(
            title: 'Không tìm thấy kế hoạch',
            description: 'Kế hoạch không còn trên phiên bản lộ trình này.',
          ),
        if (plan != null) ...[
          Panel(
            title:
                '${_skillName(catalog, _text(plan['skillId']))} · v${plan['version']}',
            children: [
              Copy(
                plan['teacherId'] == me
                    ? 'Bạn dạy kế hoạch này.'
                    : 'Bạn là người học của kế hoạch này.',
              ),
              Copy(_text(plan['learningGoal'])),
              Copy(
                plan['learnerConfirmedAt'] == null
                    ? 'Người học chưa xác nhận.'
                    : 'Người học đã xác nhận.',
                muted: true,
              ),
              if (_error != null)
                FormNotice(tone: NoticeTone.error, message: _error!),
              if (canConfirm)
                AppButton(
                  label: 'Xác nhận kế hoạch',
                  variant: ButtonVariant.craft,
                  loading: _busy,
                  onPressed: () async {
                    if (_busy) return;
                    setState(() {
                      _busy = true;
                      _error = null;
                    });
                    try {
                      await ref
                          .read(authRuntimeProvider)
                          .services
                          .study
                          .confirmPlan(
                            widget.planId,
                            expectedVersion: _version(plan['version']),
                          );
                      ref
                          .read(refreshTicksProvider.notifier)
                          .bump(const {RefreshScope.study});
                    } catch (error) {
                      setState(() => _error = errorMessage(error));
                    } finally {
                      if (mounted) setState(() => _busy = false);
                    }
                  },
                ),
              if (editable && plan['teacherId'] == me)
                AppButton(
                  label: 'Sửa kế hoạch tôi dạy',
                  variant: ButtonVariant.paper,
                  onPressed: () => context.go(
                    '/paths/${widget.id}/plans/${widget.planId}/edit',
                  ),
                ),
            ],
          ),
          if (outline.isNotEmpty)
            Panel(
              title: 'Lộ trình học',
              children: [
                _ScheduleListHeading(
                  label: 'Các buổi trong kế hoạch',
                  count: '${outline.length} buổi học',
                ),
                for (var i = 0; i < outline.length; i++)
                  ScheduleTimelineItem(
                    last: i == outline.length - 1,
                    child: _PlanTimelineStop(
                      sessionNo: _version(outline[i]['sessionNo']) == 0
                          ? i + 1
                          : _version(outline[i]['sessionNo']),
                      content: _text(outline[i]['content']),
                      session: _sessionForOutline(
                        _records(plan['sessions']),
                        _records(plan['schedule'] is Map
                            ? (plan['schedule'] as Map)['items']
                            : null),
                        _version(outline[i]['sessionNo']) == 0
                            ? i + 1
                            : _version(outline[i]['sessionNo']),
                      ),
                    ),
                  ),
              ],
            ),
        ],
      ],
    );
  }
}

Map<String, dynamic>? _sessionForOutline(
  List<Map<String, dynamic>> sessions,
  List<Map<String, dynamic>> scheduleItems,
  int sessionNo,
) {
  for (final item in sessions) {
    if (_version(item['sessionNo']) == sessionNo) return item;
  }
  for (final item in scheduleItems) {
    if (_version(item['sessionNo']) == sessionNo) return item;
  }
  return null;
}

/// RN `PlanTimelineRow` — stop card on the plan-detail rail.
class _PlanTimelineStop extends StatelessWidget {
  const _PlanTimelineStop({
    required this.sessionNo,
    required this.content,
    this.session,
  });

  final int sessionNo;
  final String content;
  final Map<String, dynamic>? session;

  @override
  Widget build(BuildContext context) {
    final parts = sessionContentParts(content);
    final start = DateTime.tryParse(_text(session?['startAt']));
    final end = DateTime.tryParse(_text(session?['endAt']));
    final duration = start != null && end != null
        ? end.difference(start).inMinutes
        : 0;
    final status = session?['status']?.toString();
    final ongoing = status == 'ONGOING';
    final sessionId = _text(session?['id']);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: ongoing ? AppColors.primarySoft : AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(AppRadii.control),
        border: Border.all(
          color: ongoing ? AppColors.primary : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 8,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  ongoing
                      ? 'ĐANG HỌC · BUỔI $sessionNo'
                      : 'BUỔI $sessionNo',
                  style: nunito(
                    TypeScale.caption,
                    weight: FontWeight.w700,
                    color: ongoing ? AppColors.primary : AppColors.muted,
                  ),
                ),
              ),
              if (duration > 0)
                Text(
                  '$duration phút',
                  style: nunito(TypeScale.caption, color: AppColors.muted),
                ),
            ],
          ),
          Text(
            parts.title.trim().isEmpty ? 'Buổi $sessionNo' : parts.title.trim(),
            style: nunito(
              TypeScale.body,
              weight: FontWeight.w600,
              color: AppColors.ink,
            ),
          ),
          if (parts.description.trim().isNotEmpty)
            Text(
              parts.description.trim(),
              style: nunito(TypeScale.secondary, color: AppColors.body),
            ),
          if (status != null && _sessionStatusLabel.containsKey(status))
            Text(
              _sessionStatusLabel[status]!,
              style: nunito(
                TypeScale.secondary,
                weight: FontWeight.w600,
                color: ongoing
                    ? AppColors.primary
                    : status == 'COMPLETED'
                    ? AppColors.forest
                    : AppColors.muted,
              ),
            ),
          if (isLiveId(sessionId))
            AppButton(
              label: 'Mở buổi học',
              variant: ButtonVariant.paper,
              onPressed: () => context.go('/learning-sessions/$sessionId'),
            ),
        ],
      ),
    );
  }
}

class LivePlanEditor extends ConsumerStatefulWidget {
  const LivePlanEditor({super.key, required this.id, this.planId});

  final String id;
  final String? planId;

  @override
  ConsumerState<LivePlanEditor> createState() => _LivePlanEditorState();
}

class _LivePlanEditorState extends ConsumerState<LivePlanEditor> {
  String? _skillId;
  final _goal = AppField(validator: _goalRule);
  SessionOutlineController? _outline;
  var _seeded = false;
  var _submitting = false;
  String? _formError;

  @override
  void dispose() {
    _goal.dispose();
    _outline?.dispose();
    super.dispose();
  }

  void _seed(
    Map<String, dynamic>? plan, {
    required List<({String id, String name})> options,
  }) {
    if (_seeded) return;
    _seeded = true;
    final draft = ref.read(planSuggestionDraftProvider);
    final fromDraft = draft != null && draft.sessions.isNotEmpty;
    if (fromDraft) {
      _goal.text = draft.goal;
      _outline = SessionOutlineController(initial: draft.sessions);
      final skillKey = draft.skill.toLowerCase();
      for (final skill in options) {
        final name = skill.name.toLowerCase();
        if (name == skillKey ||
            name.contains(skillKey) ||
            skillKey.contains(name)) {
          _skillId = skill.id;
          break;
        }
      }
      return;
    }
    _goal.text = plan?['learningGoal']?.toString() ?? '';
    final lines = [
      for (final item in _records(plan?['sessionOutline']))
        _text(item['content']).trim(),
    ].where((line) => line.isNotEmpty).toList();
    _outline = SessionOutlineController(initial: lines);
  }

  Future<void> _submitPlan({
    required String skillId,
    required Map<String, dynamic>? plan,
  }) async {
    if (_submitting) return;
    final outline = _outline;
    if (outline == null) return;
    final goalOk = validateFields([_goal]);
    final outlineError = outline.validate();
    if (!goalOk || outlineError != null) {
      setState(() => _formError = outlineError);
      return;
    }
    final lines = [
      for (final content in outline.contents)
        if (content.trim().isNotEmpty) content.trim(),
    ];
    setState(() {
      _submitting = true;
      _formError = null;
    });
    final body = {
      'skillId': skillId,
      'learningGoal': _goal.text.trim(),
      'totalSessions': lines.length,
      'sessionOutline': [
        for (final line in lines) {'content': line},
      ],
      if (plan != null) 'expectedVersion': _version(plan['version']),
    };
    try {
      final study = ref.read(authRuntimeProvider).services.study;
      if (plan == null) {
        await study.addPlan(widget.id, body);
      } else {
        await study.revisePlan(_text(plan['id']), body);
      }
      ref.read(planSuggestionDraftProvider.notifier).clear();
      ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.study});
      if (mounted) context.go('/paths/${widget.id}');
    } catch (error) {
      if (mounted) setState(() => _formError = errorMessage(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(livePathProvider(widget.id));
    final path = query.value ?? const <String, dynamic>{};
    final me = ref.watch(accountSessionProvider)?.userId ?? '';
    final agreement = _record(path['agreement']);
    final plans = _records(path['plans']);
    final plan = widget.planId == null
        ? null
        : plans.where((item) => item['id'] == widget.planId).firstOrNull;
    final catalogAsync = ref.watch(skillCatalogProvider);
    final catalog = catalogAsync.value ?? const <SkillRecord>[];
    final mineSkills = [
      for (final skill in ref.watch(skillsProvider))
        if (!skill.archived) skill,
    ];
    final skillsReady = ref.watch(skillsProvider.notifier).ready;
    // Prefer skills the user already teaches; fall back to catalog ids.
    final options = <({String id, String name})>[];
    final seen = <String>{};
    for (final skill in mineSkills) {
      if (seen.add(skill.skillId)) {
        options.add((id: skill.skillId, name: skill.name));
      }
    }
    if (options.isEmpty) {
      for (final skill in catalog) {
        if (seen.add(skill.id)) {
          options.add((id: skill.id, name: skill.name));
        }
      }
    }
    final optionsLoading =
        options.isEmpty &&
        ((!skillsReady && mineSkills.isEmpty) ||
            (catalogAsync.isLoading && catalog.isEmpty));
    final editable = _editablePath(path);
    final canEdit =
        path.isNotEmpty &&
        editable &&
        me.isNotEmpty &&
        (plan != null
            ? plan['teacherId'] == me
            : !plans.any((item) => item['teacherId'] == me) &&
                  (agreement['exchangeType'] == 'TWO_WAY' ||
                      agreement['teacherId'] == me));
    final names = {for (final skill in options) skill.id: skill.name};
    final draft = ref.watch(planSuggestionDraftProvider);
    final draftReady = draft != null && draft.sessions.isNotEmpty;
    if (canEdit && options.isNotEmpty) {
      _seed(plan, options: options);
    }
    final selected = _skillId ?? plan?['skillId']?.toString();
    return FeaturePage(
      onRefresh: () => pullRefresh(ref, const {
        RefreshScope.study,
        RefreshScope.skills,
      }),
      title: plan != null ? 'Sửa kế hoạch tôi dạy' : 'Tạo kế hoạch tôi dạy',
      back: '/paths/${widget.id}',
      children: [
        if (query.isLoading && path.isEmpty)
          const LiveBusyNote(label: 'Đang tải lộ trình.'),
        if (!query.isLoading && !canEdit)
          const EmptyState(
            title: 'Không thể sửa kế hoạch này',
            description:
                'Bạn chỉ tạo hoặc sửa kế hoạch mình dạy khi lộ trình còn thương lượng.',
          ),
        if (canEdit && optionsLoading)
          const LiveBusyNote(label: 'Đang tải kỹ năng của bạn.'),
        if (canEdit &&
            !optionsLoading &&
            catalogAsync.hasError &&
            options.isEmpty &&
            !isTransientReadError(catalogAsync.error))
          FormNotice(
            tone: NoticeTone.error,
            message: errorMessage(catalogAsync.error),
          ),
        if (canEdit && !optionsLoading && options.isEmpty)
          EmptyState(
            title: mineSkills.isEmpty && skillsReady
                ? 'Bạn chưa có kỹ năng để dạy'
                : 'Chưa có kỹ năng trong danh mục',
            description: mineSkills.isEmpty && skillsReady
                ? 'Thêm kỹ năng trong hồ sơ dạy học trước khi tạo kế hoạch.'
                : 'Kế hoạch cần một kỹ năng đã có trên máy chủ.',
            action: mineSkills.isEmpty && skillsReady ? 'Quản lý kỹ năng' : null,
            onAction: mineSkills.isEmpty && skillsReady
                ? () => context.push('/skills')
                : null,
          ),
        if (canEdit && options.isNotEmpty)
          Panel(
            title: 'Thiết kế hành trình học',
            children: [
              if (draftReady)
                const FormNotice(
                  tone: NoticeTone.success,
                  message:
                      'Đã điền mục tiêu và các buổi từ gợi ý Chat. Kiểm tra rồi lưu kế hoạch.',
                ),
              ChoiceGroup(
                label: 'Kỹ năng bạn dạy',
                value: names[selected] ?? options.first.name,
                options: [for (final skill in options) skill.name],
                onChange: (value) {
                  final match = options.where((skill) => skill.name == value);
                  if (match.isNotEmpty) {
                    setState(() => _skillId = match.first.id);
                  }
                },
              ),
              AppInput(
                field: _goal,
                label: 'Mục tiêu học',
                multiline: true,
                editable: !_submitting,
              ),
              if (_outline != null)
                SessionOutlineEditor(
                  controller: _outline!,
                  enabled: !_submitting,
                  helper: 'Mỗi thẻ là một buổi. Thêm tiêu đề và mô tả tùy chọn.',
                ),
              if (_formError != null)
                FormNotice(tone: NoticeTone.error, message: _formError!),
              AppButton(
                label: _submitting ? 'Đang gửi...' : 'Gửi kế hoạch',
                variant: ButtonVariant.craft,
                loading: _submitting,
                onPressed: () => _submitPlan(
                  skillId: selected ?? options.first.id,
                  plan: plan,
                ),
              ),
            ],
          ),
      ],
    );
  }
}

class LiveTermsEditor extends ConsumerStatefulWidget {
  const LiveTermsEditor({super.key, required this.id});

  final String id;

  @override
  ConsumerState<LiveTermsEditor> createState() => _LiveTermsEditorState();
}

class _LiveTermsEditorState extends ConsumerState<LiveTermsEditor> {
  String? _type;
  String? _role;

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(livePathProvider(widget.id));
    final path = query.value ?? const <String, dynamic>{};
    final me = ref.watch(accountSessionProvider)?.userId ?? '';
    final agreement = _record(path['agreement']);
    final type = _type ?? agreement['exchangeType']?.toString() ?? 'TWO_WAY';
    final teacher = agreement['teacherId']?.toString();
    final role =
        _role ?? (teacher != null && teacher != me ? 'Tôi học' : 'Tôi dạy');
    final other = path['participantAId'] == me
        ? _text(path['participantBId'])
        : _text(path['participantAId']);
    final twoWay = type == 'TWO_WAY';
    final editable = path.isNotEmpty && _editablePath(path);
    final credit =
        agreement['totalCreditPerUser'] ?? agreement['negotiatedCredit'] ?? '20';
    return FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.study}),
      title: 'Điều chỉnh điều khoản',
      back: '/paths/${widget.id}',
      children: [
        if (query.isLoading && path.isEmpty)
          const LiveBusyNote(label: 'Đang tải điều khoản.'),
        if (!query.isLoading && !editable)
          const EmptyState(
            title: 'Điều khoản đã khóa',
            description:
                'Chỉ sửa điều khoản khi lộ trình chưa khóa phiên bản.',
          ),
        if (editable)
          Panel(
            title: 'Thống nhất lại trước khi chốt',
            children: [
              const Copy(
                'Thay đổi điều khoản tạo phiên bản mới. Hai bên cần xác nhận lại.',
                muted: true,
              ),
              ChoiceGroup(
                label: 'Hình thức',
                value: twoWay ? 'Trao đổi hai chiều' : 'Học một chiều',
                options: const ['Trao đổi hai chiều', 'Học một chiều'],
                onChange: (value) => setState(
                  () => _type = value == 'Trao đổi hai chiều'
                      ? 'TWO_WAY'
                      : 'ONE_WAY',
                ),
              ),
              if (!twoWay)
                ChoiceGroup(
                  label: 'Vai trò của bạn',
                  value: role,
                  options: const ['Tôi dạy', 'Tôi học'],
                  onChange: (value) => setState(() => _role = value),
                ),
              DataForm(
                key: ValueKey(type),
                defaults: {'credit': _text(credit)},
                fields: [
                  DataField(
                    name: 'credit',
                    label: twoWay
                        ? 'Credit cam kết mỗi người'
                        : 'Credit cho toàn lộ trình',
                    rule: creditRule(twoWay ? 20 : 0, twoWay),
                    numeric: true,
                  ),
                ],
                submitLabel: 'Gửi điều khoản mới',
                onSubmit: (values) async {
                  final teacherId = role == 'Tôi dạy' ? me : other;
                  final learnerId = role == 'Tôi dạy' ? other : me;
                  try {
                    await ref
                        .read(authRuntimeProvider)
                        .services
                        .study
                        .revisePath(
                          widget.id,
                          twoWay
                              ? {
                                  'exchangeType': 'TWO_WAY',
                                  'totalCreditPerUser': values['credit'],
                                  'expectedVersion': _version(
                                    path['currentVersion'],
                                  ),
                                }
                              : {
                                  'exchangeType': 'ONE_WAY',
                                  'teacherId': teacherId,
                                  'learnerId': learnerId,
                                  'negotiatedCredit': values['credit'],
                                  'expectedVersion': _version(
                                    path['currentVersion'],
                                  ),
                                },
                        );
                    ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.study});
                    if (context.mounted) {
                      context.go('/paths/${widget.id}');
                    }
                    return null;
                  } catch (error) {
                    return errorMessage(error);
                  }
                },
              ),
            ],
          ),
      ],
    );
  }
}

String _skillName(List<SkillRecord> catalog, String id) {
  for (final skill in catalog) {
    if (skill.id == id) return skill.name;
  }
  return 'Kế hoạch';
}

String? _goalRule(String value) {
  final text = value.trim();
  if (text.isEmpty || text.length > 1500) {
    return 'Mục tiêu từ 1 đến 1500 ký tự.';
  }
  return null;
}

class LiveSchedulesPage extends ConsumerStatefulWidget {
  const LiveSchedulesPage({super.key, required this.id});

  final String id;

  @override
  ConsumerState<LiveSchedulesPage> createState() => _LiveSchedulesPageState();
}

class _LiveSchedulesPageState extends ConsumerState<LiveSchedulesPage> {
  String? _error;
  String? _busy;

  Future<void> _confirm(Map<String, dynamic> schedule) async {
    if (_busy != null) return;
    setState(() {
      _busy = _text(schedule['id']);
      _error = null;
    });
    try {
      await ref.read(authRuntimeProvider).services.study.confirmSchedule(
        _text(schedule['id']),
        {'expectedVersion': _version(schedule['version'])},
      );
      ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.study});
    } catch (error) {
      setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(livePathProvider(widget.id));
    final path = query.value ?? const <String, dynamic>{};
    final me = ref.watch(accountSessionProvider)?.userId ?? '';
    final catalog = ref.watch(skillCatalogProvider).value ?? const <SkillRecord>[];
    final plans = _records(path['plans']);
    return FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.study}),
      title: 'Lịch của từng kế hoạch',
      back: '/paths/${widget.id}',
      children: [
        WaitingRefresh(
          scopes: const {RefreshScope.study},
          interval: const Duration(seconds: 5),
          enabled: _awaitingPeerConfirmation(path, me),
          child: const SizedBox.shrink(),
        ),
        if (query.isLoading && path.isEmpty)
          const LiveBusyNote(label: 'Đang tải lịch.'),
        if (query.hasError && path.isEmpty)
          FormNotice(tone: NoticeTone.error, message: errorMessage(query.error)),
        if (query.hasValue && path.isEmpty)
          const EmptyState(
            title: 'Không tìm thấy lộ trình',
            description: 'Lộ trình không còn trên máy chủ hoặc bạn không tham gia.',
          ),
        if (path.isNotEmpty) ...[
          _ScheduleExchangeBanner(path: path),
          const _ScheduleTimezoneNotice(),
          if (path['status'] != 'CONFIRMED' && path['lockedVersion'] == null)
            const Copy(
              'Cần đủ kế hoạch, xác nhận người học và xác nhận điều khoản của cả hai trước khi đề xuất lịch.',
            ),
          if (_error != null) FormNotice(tone: NoticeTone.error, message: _error!),
          for (final plan in plans)
            _SchedulePanel(
              pathId: widget.id,
              path: path,
              plan: plan,
              me: me,
              title: _skillName(catalog, _text(plan['skillId'])),
              busy: _busy,
              onConfirm: _confirm,
            ),
          if (path['lockedVersion'] == null)
            AppButton(
              label: 'Kiểm tra trước khi chốt lịch',
              variant: ButtonVariant.paper,
              onPressed: () => context.go('/paths/${widget.id}/hold'),
            ),
        ],
      ],
    );
  }
}

class _ScheduleExchangeBanner extends StatelessWidget {
  const _ScheduleExchangeBanner({required this.path});

  final Map<String, dynamic> path;

  @override
  Widget build(BuildContext context) {
    final agreement = _record(path['agreement']);
    final twoWay = agreement['exchangeType'] == 'TWO_WAY';
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        spacing: 11,
        children: [
          Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(AppRadii.control),
            ),
            child: AppIcon(
              twoWay ? AppIcon.users : AppIcon.book,
              size: 18,
              color: AppColors.primary,
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 3,
              children: [
                Text(
                  twoWay ? 'Trao đổi hai chiều' : 'Học một chiều',
                  style: nunito(
                    TypeScale.body,
                    weight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
                Text(
                  twoWay
                      ? 'Hai lịch riêng: bạn dạy và bạn học. Mỗi lịch cần cả hai xác nhận.'
                      : 'Một lịch cho lộ trình đã thống nhất. Cả hai cùng xác nhận lịch.',
                  style: nunito(TypeScale.secondary, color: AppColors.muted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ScheduleTimezoneNotice extends StatelessWidget {
  const _ScheduleTimezoneNotice();

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 7,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 1),
          child: AppIcon(AppIcon.clock, size: 13, color: AppColors.muted),
        ),
        Expanded(
          child: Text(
            'Giờ theo múi giờ thiết bị. Lịch cần cả hai xác nhận; buổi học và Credit chỉ được tạo, tạm giữ khi chốt lộ trình.',
            style: nunito(TypeScale.caption, color: AppColors.muted),
          ),
        ),
      ],
    );
  }
}

class _SchedulePanel extends StatelessWidget {
  const _SchedulePanel({
    required this.pathId,
    required this.path,
    required this.plan,
    required this.me,
    required this.title,
    required this.busy,
    required this.onConfirm,
  });

  final String pathId;
  final Map<String, dynamic> path;
  final Map<String, dynamic> plan;
  final String me;
  final String title;
  final String? busy;
  final Future<void> Function(Map<String, dynamic> schedule) onConfirm;

  @override
  Widget build(BuildContext context) {
    final schedule = _scheduleOf(plan);
    final mine = plan['teacherId'] == me;
    final partnerConfirmed = schedule == null
        ? false
        : (path['participantAId'] == me
              ? schedule['participantBConfirmedAt']
              : schedule['participantAConfirmedAt']) !=
          null;
    final sessions = _records(plan['sessions']);
    final total = _version(plan['totalSessions']);
    final outline = _records(plan['sessionOutline']);
    final scheduleItems = _records(schedule?['items']);
    return Panel(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 8,
                children: [
                  Text(
                    title,
                    style: nunito(
                      TypeScale.heading,
                      weight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 9,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: mine
                              ? AppColors.primarySoft
                              : AppColors.forestSoft,
                          borderRadius: BorderRadius.circular(AppRadii.badge),
                        ),
                        child: Text(
                          mine ? 'Bạn dạy' : 'Bạn học',
                          style: nunito(
                            TypeScale.secondary,
                            weight: FontWeight.w600,
                            color: mine ? AppColors.primary : AppColors.forest,
                          ),
                        ),
                      ),
                      Text(
                        '$total buổi',
                        style: nunito(
                          TypeScale.secondary,
                          color: AppColors.muted,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              decoration: BoxDecoration(
                color: schedule == null
                    ? AppColors.surfaceLow
                    : AppColors.amberSoft,
                borderRadius: BorderRadius.circular(AppRadii.badge),
              ),
              child: Text(
                schedule == null
                    ? 'Chờ xếp lịch'
                    : (_scheduleStatusLabel[schedule['status']] ??
                          '${schedule['status']}'),
                style: nunito(
                  TypeScale.secondary,
                  weight: FontWeight.w600,
                  color: schedule == null
                      ? AppColors.muted
                      : AppColors.amber,
                ),
              ),
            ),
          ],
        ),
        if (_text(plan['learningGoal']).isNotEmpty)
          Text(
            _text(plan['learningGoal']),
            style: nunito(
              TypeScale.body,
              weight: FontWeight.w600,
              color: AppColors.body,
            ),
          ),
        if (sessions.isNotEmpty) ...[
          _ScheduleListHeading(
            label: 'Buổi học đã tạo',
            count: '${sessions.length} / $total buổi',
          ),
          for (var i = 0; i < sessions.length; i++)
            ScheduleTimelineItem(
              last: i == sessions.length - 1,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 8,
                children: [
                  ScheduleSlotRow(
                    sessionNo: _version(sessions[i]['sessionNo']) == 0
                        ? i + 1
                        : _version(sessions[i]['sessionNo']),
                    title: sessionContentParts(
                      _outlineContent(
                        outline,
                        _version(sessions[i]['sessionNo']) == 0
                            ? i + 1
                            : _version(sessions[i]['sessionNo']),
                      ),
                    ).title,
                    startAt: DateTime.tryParse(_text(sessions[i]['startAt'])),
                    endAt: DateTime.tryParse(_text(sessions[i]['endAt'])),
                    status: _sessionStatusLabel[sessions[i]['status']],
                  ),
                  if (isLiveId(_text(sessions[i]['id'])))
                    AppButton(
                      label: 'Mở buổi ${_version(sessions[i]['sessionNo']) == 0 ? i + 1 : _version(sessions[i]['sessionNo'])}',
                      variant: ButtonVariant.paper,
                      onPressed: () =>
                          context.go('/learning-sessions/${sessions[i]['id']}'),
                    ),
                ],
              ),
            ),
        ] else if (schedule != null) ...[
          _ScheduleListHeading(
            label: 'Lịch từng buổi',
            count: '${scheduleItems.length} / $total buổi sẵn sàng',
          ),
          if (schedule['status'] == 'NEEDS_REVISION')
            Copy(
              scheduleItems.length == total
                  ? 'Lịch đã điều chỉnh. Hai bên cần xem và xác nhận phiên bản này.'
                  : 'Lộ trình đã đổi số buổi. Người dạy cần bổ sung lịch còn thiếu trước khi hai bên xác nhận.',
              muted: true,
            ),
          for (var i = 0; i < total; i++)
            ScheduleTimelineItem(
              last: i == total - 1,
              child: ScheduleSlotRow(
                sessionNo: i + 1,
                title: sessionContentParts(
                  _outlineContent(outline, i + 1),
                ).title,
                startAt: DateTime.tryParse(
                  _text(_itemForSession(scheduleItems, i + 1)?['startAt']),
                ),
                endAt: DateTime.tryParse(
                  _text(_itemForSession(scheduleItems, i + 1)?['endAt']),
                ),
              ),
            ),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(AppRadii.control),
            ),
            child: Copy(
              'Bạn: ${_confirmedBy(path, schedule, me) ? 'đã xác nhận' : 'chưa xác nhận'} · Đối tác: ${partnerConfirmed ? 'đã xác nhận' : 'chưa xác nhận'}',
            ),
          ),
          if (_canConfirmSchedule(path, plan, me))
            AppButton(
              label: 'Xác nhận lịch v${schedule['version']}',
              loading: busy == schedule['id'],
              disabled: busy != null,
              onPressed: () => onConfirm(schedule),
            ),
        ] else if (outline.isNotEmpty) ...[
          _ScheduleListHeading(
            label: 'Buổi theo kế hoạch',
            count: '${outline.length} buổi · chưa xếp lịch',
          ),
          for (var i = 0; i < outline.length; i++)
            ScheduleTimelineItem(
              last: i == outline.length - 1,
              child: ScheduleSlotRow(
                sessionNo: _version(outline[i]['sessionNo']) == 0
                    ? i + 1
                    : _version(outline[i]['sessionNo']),
                title: sessionContentParts(_text(outline[i]['content'])).title,
              ),
            ),
          _EmptyScheduleHint(mine: mine),
        ] else
          _EmptyScheduleHint(mine: mine),
        if (_canSchedule(path, plan, me))
          AppButton(
            label: 'Đề xuất lịch tôi dạy',
            variant: ButtonVariant.paper,
            onPressed: () =>
                context.go('/paths/$pathId/schedules/${plan['id']}'),
          ),
        if (_canEditSchedule(path, plan, me))
          AppButton(
            label: 'Chỉnh sửa lịch tôi dạy',
            variant: ButtonVariant.paper,
            onPressed: () =>
                context.go('/paths/$pathId/schedules/${plan['id']}'),
          ),
      ],
    );
  }
}

class _ScheduleListHeading extends StatelessWidget {
  const _ScheduleListHeading({required this.label, required this.count});

  final String label;
  final String count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label.toUpperCase(),
            style: nunito(
              TypeScale.caption,
              weight: FontWeight.w700,
              color: AppColors.muted,
            ),
          ),
        ),
        Text(
          count,
          style: nunito(
            TypeScale.caption,
            weight: FontWeight.w600,
            color: AppColors.primary,
          ),
        ),
      ],
    );
  }
}

class _EmptyScheduleHint extends StatelessWidget {
  const _EmptyScheduleHint({required this.mine});

  final bool mine;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        spacing: 8,
        children: [
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(AppRadii.control),
            ),
            child: const AppIcon(
              AppIcon.calendar,
              size: 26,
              color: AppColors.muted,
            ),
          ),
          Text(
            'Chưa có đề xuất lịch',
            style: nunito(
              TypeScale.body,
              weight: FontWeight.w600,
              color: AppColors.ink,
            ),
          ),
          Text(
            mine
                ? 'Chọn ngày giờ cho từng buổi trong lộ trình bạn dạy.'
                : 'Chờ đối tác đề xuất lịch họ dạy để hai bạn cùng xem và xác nhận.',
            textAlign: TextAlign.center,
            style: nunito(TypeScale.secondary, color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}

String _outlineContent(List<Map<String, dynamic>> outline, int sessionNo) {
  for (final item in outline) {
    if (_version(item['sessionNo']) == sessionNo) {
      return _text(item['content']);
    }
  }
  if (sessionNo > 0 && sessionNo <= outline.length) {
    return _text(outline[sessionNo - 1]['content']);
  }
  return '';
}

Map<String, dynamic>? _itemForSession(
  List<Map<String, dynamic>> items,
  int sessionNo,
) {
  for (final item in items) {
    if (_version(item['sessionNo']) == sessionNo) return item;
  }
  return null;
}

class LiveScheduleEditor extends ConsumerWidget {
  const LiveScheduleEditor({super.key, required this.id, required this.planId});

  final String id;
  final String planId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = ref.watch(livePathProvider(id));
    final path = query.value ?? const <String, dynamic>{};
    final me = ref.watch(accountSessionProvider)?.userId ?? '';
    final plan = _records(path['plans']).where((item) {
      return item['id'] == planId;
    }).firstOrNull;
    final outline = _records(plan?['sessionOutline']);
    final schedule = plan == null ? null : _scheduleOf(plan);
    final ready =
        path.isNotEmpty &&
        plan != null &&
        (_canSchedule(path, plan, me) || _canEditSchedule(path, plan, me));
    return FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.study}),
      title: schedule == null ? 'Đề xuất lịch tôi dạy' : 'Chỉnh sửa lịch tôi dạy',
      back: '/paths/$id/schedules',
      children: [
        if (query.isLoading && plan == null)
          const LiveBusyNote(label: 'Đang tải kế hoạch.'),
        if (query.hasError && plan == null)
          FormNotice(tone: NoticeTone.error, message: errorMessage(query.error)),
        if (!query.isLoading && !ready)
          const EmptyState(
            title: 'Chưa thể chỉnh sửa lịch',
            description:
                'Chỉ người dạy tạo hoặc sửa lịch trước khi chốt, sau khi thỏa thuận và các lộ trình đủ xác nhận.',
          ),
        if (ready)
          _ScheduleProposalForm(
            key: ValueKey(
              '${path['currentVersion']}:${plan['version']}:${schedule?['version'] ?? 'new'}',
            ),
            pathId: id,
            planId: planId,
            planVersion: _version(plan['version']),
            outline: outline,
            schedule: schedule,
            externalBusy: [
              for (final other in _records(path['plans']))
                if (other['id'] != planId)
                  for (final item in _records(_scheduleOf(other)?['items']))
                    if (DateTime.tryParse(_text(item['startAt'])) != null &&
                        DateTime.tryParse(_text(item['endAt'])) != null)
                      (
                        start: DateTime.parse(_text(item['startAt'])).toLocal(),
                        end: DateTime.parse(_text(item['endAt'])).toLocal(),
                        label:
                            'lịch đề xuất khác (buổi ${_version(item['sessionNo'])})',
                      ),
            ],
          ),
      ],
    );
  }
}

class _ScheduleProposalForm extends ConsumerStatefulWidget {
  const _ScheduleProposalForm({
    super.key,
    required this.pathId,
    required this.planId,
    required this.planVersion,
    required this.outline,
    this.schedule,
    this.externalBusy = const [],
  });

  final String pathId;
  final String planId;
  final int planVersion;
  final List<Map<String, dynamic>> outline;
  final Map<String, dynamic>? schedule;
  final List<({DateTime start, DateTime end, String label})> externalBusy;

  @override
  ConsumerState<_ScheduleProposalForm> createState() =>
      _ScheduleProposalFormState();
}

class _ScheduleProposalFormState extends ConsumerState<_ScheduleProposalForm> {
  late final List<AppField> _starts = [
    for (var i = 0; i < widget.outline.length; i++)
      AppField(text: _slotStart(widget.schedule, i), validator: _localStartRule),
  ];
  late final List<AppField> _minutes = [
    for (var i = 0; i < widget.outline.length; i++)
      AppField(
        text: _slotMinutes(widget.schedule, i),
        validator: integerRule(60, 180),
      ),
  ];
  String? _error;
  final Map<int, String> _slotErrors = {};
  var _submitting = false;
  var _applied = false;
  int? _active;

  int get _filledCount {
    var count = 0;
    for (var i = 0; i < _starts.length; i++) {
      if (parseLocalDateTime(_starts[i].text.trim()) != null &&
          RegExp(r'^\d+$').hasMatch(_minutes[i].text.trim())) {
        count++;
      }
    }
    return count;
  }

  List<DateTime?> get _parsedStarts => [
    for (final field in _starts) parseLocalDateTime(field.text.trim()),
  ];

  List<int?> get _parsedMinutes => [
    for (final field in _minutes)
      RegExp(r'^\d+$').hasMatch(field.text.trim())
          ? int.parse(field.text.trim())
          : null,
  ];

  void _recheckOverlaps({int? focus}) {
    _slotErrors.clear();
    final starts = _parsedStarts;
    final minutes = _parsedMinutes;
    for (var i = 0; i < starts.length; i++) {
      final message = scheduleSlotConflictAt(
        i,
        starts,
        minutes,
        external: widget.externalBusy,
      );
      if (message != null) _slotErrors[i] = message;
    }
    final filledStarts = <DateTime>[];
    final filledMinutes = <int>[];
    for (var i = 0; i < starts.length; i++) {
      final start = starts[i];
      final minute = minutes[i];
      if (start == null || minute == null) continue;
      filledStarts.add(start);
      filledMinutes.add(minute);
    }
    if (filledStarts.length == starts.length) {
      _error = scheduleSlotError(
        filledStarts,
        filledMinutes,
        external: widget.externalBusy,
      );
    } else if (focus != null && _slotErrors[focus] != null) {
      _error = 'Buổi ${focus + 1}: ${_slotErrors[focus]}';
    } else if (_slotErrors.isNotEmpty) {
      final first = _slotErrors.entries.first;
      _error = 'Buổi ${first.key + 1}: ${first.value}';
    } else {
      _error = null;
    }
  }

  @override
  void dispose() {
    for (final field in _starts) {
      field.dispose();
    }
    for (final field in _minutes) {
      field.dispose();
    }
    super.dispose();
  }

  void _applyWeekly(List<WeeklyScheduleSlot> items) {
    setState(() {
      for (var i = 0; i < items.length && i < _starts.length; i++) {
        _starts[i].text = items[i].local;
        _starts[i].touched = false;
        _minutes[i].text = items[i].minutes;
        _minutes[i].touched = false;
      }
      _active = null;
      _applied = true;
      _recheckOverlaps();
    });
  }

  Future<void> _pickStart(int index) async {
    if (_submitting) return;
    final current = parseLocalDateTime(_starts[index].text.trim());
    final now = DateTime.now();
    final fallback = DateTime(now.year, now.month, now.day + 1, 19);
    final picked = await pickScheduleDateTime(context, current ?? fallback);
    if (picked == null || !mounted) return;
    setState(() {
      _starts[index].text = localDateInput(picked);
      _starts[index].touched = true;
      _recheckOverlaps(focus: index);
    });
  }

  void _setMinutes(int index, String value) {
    setState(() {
      _minutes[index].text = value;
      _minutes[index].touched = true;
      _recheckOverlaps(focus: index);
    });
  }

  Future<void> _submit() async {
    if (_submitting) return;
    final valid = validateFields([..._starts, ..._minutes]);
    if (!valid) {
      final index = List.generate(_starts.length, (i) => i).indexWhere(
        (i) => _starts[i].error != null || _minutes[i].error != null,
      );
      setState(() => _active = index < 0 ? _active : index);
      return;
    }
    final starts = [
      for (final field in _starts) parseLocalDateTime(field.text.trim())!,
    ];
    final minutes = [for (final field in _minutes) int.parse(field.text.trim())];
    final invalid = scheduleSlotError(
      starts,
      minutes,
      external: widget.externalBusy,
    );
    if (invalid != null) {
      setState(() {
        _error = invalid;
        _recheckOverlaps();
      });
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final items = [
        for (var i = 0; i < starts.length; i++)
          {
            'sessionNo': i + 1,
            'startAt': starts[i].toUtc().toIso8601String(),
            'endAt': starts[i]
                .add(Duration(minutes: minutes[i]))
                .toUtc()
                .toIso8601String(),
          },
      ];
      final schedule = widget.schedule;
      final study = ref.read(authRuntimeProvider).services.study;
      if (schedule == null) {
        await study.proposeSchedule(widget.planId, {
          'expectedPlanVersion': widget.planVersion,
          'items': items,
        });
      } else {
        await study.reviseSchedule(_text(schedule['id']), {
          'expectedVersion': _version(schedule['version']),
          'items': items,
        });
      }
      ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.study});
      if (mounted) context.go('/paths/${widget.pathId}/schedules');
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _submitLabel() {
    final count = widget.outline.length;
    if (_submitting) return 'Đang gửi...';
    final action = widget.schedule == null
        ? 'Gửi đề xuất lịch'
        : 'Lưu thay đổi lịch';
    return '$action ($count buổi)';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 16,
      children: [
        ScheduleWeeklyGenerator(
          count: widget.outline.length,
          disabled: _submitting,
          onApply: _applyWeekly,
        ),
        if (_applied)
          const FormNotice(
            tone: NoticeTone.success,
            message:
                'Đã điền lịch tuần. Xem lại hoặc sửa từng buổi trước khi gửi.',
          ),
        if (widget.schedule != null)
          const Copy(
            'Giữ nguyên giờ của các buổi chưa sửa. Nếu lịch thay đổi, hai bên cần xác nhận phiên bản mới.',
            muted: true,
          ),
        Panel(
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceInset,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '2',
                    style: nunito(
                      TypeScale.secondary,
                      weight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Lịch từng buổi',
                    style: nunito(
                      TypeScale.heading,
                      weight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                ),
                Text(
                  '$_filledCount/${widget.outline.length} buổi đã điền',
                  style: nunito(
                    TypeScale.secondary,
                    weight: FontWeight.w600,
                    color: AppColors.muted,
                  ),
                ),
              ],
            ),
            for (final (index, lesson) in widget.outline.indexed)
              ScheduleTimelineItem(
                last: index == widget.outline.length - 1,
                child: _ScheduleSessionCard(
                  sessionNo: _version(lesson['sessionNo']) == 0
                      ? index + 1
                      : _version(lesson['sessionNo']),
                  content: _text(lesson['content']),
                  startField: _starts[index],
                  minutesField: _minutes[index],
                  open: _active == index,
                  disabled: _submitting,
                  overlapError: _slotErrors[index],
                  onToggle: () => setState(
                    () => _active = _active == index ? null : index,
                  ),
                  onDone: () => setState(() {
                    _recheckOverlaps(focus: index);
                    if (_slotErrors[index] == null) _active = null;
                  }),
                  onPickStart: () => _pickStart(index),
                  onSelectMinutes: (value) => _setMinutes(index, value),
                ),
              ),
          ],
        ),
        Copy(
          'Giờ theo thiết bị · ${_deviceZone()}',
          muted: true,
        ),
        Panel(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 10,
              children: [
                const AppIcon(
                  AppIcon.checkCircle,
                  size: 20,
                  color: AppColors.forest,
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    spacing: 4,
                    children: [
                      Text(
                        'Trước khi chốt lịch',
                        style: nunito(
                          TypeScale.body,
                          weight: FontWeight.w700,
                          color: AppColors.ink,
                        ),
                      ),
                      Text(
                        'Hai bên cần xác nhận cùng phiên bản lịch. Credit chỉ tạm giữ và buổi học chỉ được tạo khi chốt thỏa thuận.',
                        style: nunito(
                          TypeScale.secondary,
                          color: AppColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
        if (_error != null) FormNotice(tone: NoticeTone.error, message: _error!),
        AppButton(
          label: _submitLabel(),
          variant: ButtonVariant.craft,
          loading: _submitting,
          disabled: _submitting || _slotErrors.isNotEmpty,
          onPressed: _submit,
        ),
      ],
    );
  }
}

class _ScheduleSessionCard extends StatelessWidget {
  const _ScheduleSessionCard({
    required this.sessionNo,
    required this.content,
    required this.startField,
    required this.minutesField,
    required this.open,
    required this.disabled,
    required this.onToggle,
    required this.onDone,
    required this.onPickStart,
    required this.onSelectMinutes,
    this.overlapError,
  });

  final int sessionNo;
  final String content;
  final AppField startField;
  final AppField minutesField;
  final bool open;
  final bool disabled;
  final String? overlapError;
  final VoidCallback onToggle;
  final VoidCallback onDone;
  final VoidCallback onPickStart;
  final ValueChanged<String> onSelectMinutes;

  @override
  Widget build(BuildContext context) {
    final topic = sessionContentParts(content);
    return ListenableBuilder(
      listenable: Listenable.merge([startField, minutesField]),
      builder: (context, _) {
        final local = startField.text.trim();
        final minutes = minutesField.text.trim().isEmpty
            ? '60'
            : minutesField.text.trim();
        final collapsedError = !open
            ? (overlapError ?? startField.error ?? minutesField.error)
            : null;
        final hasOverlap = overlapError != null;
        return Container(
          margin: EdgeInsets.only(bottom: open ? 8 : 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(
              color: hasOverlap
                  ? AppColors.error
                  : open
                  ? AppColors.primaryMuted
                  : AppColors.border,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 10,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLow,
                      borderRadius: BorderRadius.circular(AppRadii.badge),
                    ),
                    child: Text(
                      'Buổi $sessionNo',
                      style: nunito(
                        TypeScale.secondary,
                        weight: FontWeight.w700,
                        color: AppColors.body,
                      ),
                    ),
                  ),
                  const Spacer(),
                  AppButton(
                    label: open ? 'Thu gọn' : 'Sửa',
                    variant: ButtonVariant.paper,
                    size: ButtonSize.sm,
                    disabled: disabled,
                    semanticLabel: 'Sửa lịch buổi $sessionNo',
                    onPressed: onToggle,
                  ),
                ],
              ),
              Row(
                spacing: 8,
                children: [
                  const AppIcon(
                    AppIcon.clock,
                    size: 18,
                    color: AppColors.muted,
                  ),
                  Expanded(
                    child: Text(
                      scheduleSlotLabel(local, minutes),
                      style: nunito(
                        TypeScale.body,
                        weight: FontWeight.w600,
                        color: AppColors.ink,
                      ),
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.only(left: 10),
                decoration: const BoxDecoration(
                  border: Border(
                    left: BorderSide(color: AppColors.border, width: 2),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: 4,
                  children: [
                    Text(
                      topic.title.isEmpty
                          ? 'Buổi $sessionNo'
                          : topic.title,
                      style: nunito(
                        TypeScale.secondary,
                        weight: FontWeight.w600,
                        color: AppColors.ink,
                      ),
                    ),
                    if (topic.description.trim().isNotEmpty)
                      Text(
                        topic.description.trim(),
                        style: nunito(
                          TypeScale.secondary,
                          color: AppColors.muted,
                        ),
                      ),
                  ],
                ),
              ),
              if (collapsedError != null) FieldError(collapsedError),
              if (open) ...[
                const Divider(height: 1, color: AppColors.border),
                Text(
                  'Ngày giờ buổi $sessionNo',
                  style: FeatureStyles.label,
                ),
                AppButton(
                  label: local.isEmpty
                      ? 'Chọn ngày và giờ'
                      : scheduleSlotLabel(local, minutes).split(' – ').first,
                  variant: ButtonVariant.paper,
                  disabled: disabled,
                  onPressed: onPickStart,
                ),
                if (startField.error != null) FieldError(startField.error!),
                if (overlapError != null) FieldError(overlapError!),
                AppInput(
                  field: minutesField,
                  label: 'Thời lượng buổi $sessionNo (phút)',
                  editable: !disabled,
                  keyboardType: TextInputType.number,
                ),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final value in const [60, 90, 120, 180])
                      Tappable(
                        semanticLabel: '$value phút',
                        disabled: disabled,
                        onTap: () => onSelectMinutes('$value'),
                        child: Container(
                          constraints: const BoxConstraints(
                            minHeight: 40,
                            minWidth: 54,
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: minutes == '$value'
                                ? AppColors.surfaceInset
                                : AppColors.surfaceLow,
                            borderRadius: BorderRadius.circular(
                              AppRadii.control,
                            ),
                            border: Border.all(
                              color: AppColors.border,
                              width: minutes == '$value' ? 1.5 : 1,
                            ),
                          ),
                          child: Text(
                            '$value phút',
                            style: nunito(
                              TypeScale.secondary,
                              weight: minutes == '$value'
                                  ? FontWeight.w700
                                  : FontWeight.w600,
                              color: AppColors.body,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                Align(
                  alignment: Alignment.centerLeft,
                  child: AppButton(
                    label: 'Xong',
                    variant: ButtonVariant.paper,
                    size: ButtonSize.sm,
                    disabled: disabled,
                    onPressed: onDone,
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

String _slotStart(Map<String, dynamic>? schedule, int index) {
  final item = _slotItem(schedule, index);
  final start = DateTime.tryParse(_text(item?['startAt']));
  return start == null ? '' : localDateInput(start);
}

String _slotMinutes(Map<String, dynamic>? schedule, int index) {
  final item = _slotItem(schedule, index);
  final start = DateTime.tryParse(_text(item?['startAt']));
  final end = DateTime.tryParse(_text(item?['endAt']));
  if (start == null || end == null) return '60';
  final minutes = end.difference(start).inMinutes;
  if (minutes < 60) return '60';
  if (minutes > 180) return '180';
  return '$minutes';
}

Map<String, dynamic>? _slotItem(Map<String, dynamic>? schedule, int index) {
  final items = [..._records(schedule?['items'])]
    ..sort(
      (a, b) => _version(a['sessionNo']).compareTo(_version(b['sessionNo'])),
    );
  if (index < 0 || index >= items.length) return null;
  return items[index];
}

String? _localStartRule(String value) {
  final date = parseLocalDateTime(value.trim());
  if (date == null) return 'Chọn ngày và giờ bắt đầu.';
  if (!date.isAfter(DateTime.now())) return 'Buổi học phải ở tương lai.';
  return null;
}

String _deviceZone() => DateTime.now().timeZoneOffset.inHours == 7
    ? 'Asia/Ho_Chi_Minh'
    : 'Asia/Ho_Chi_Minh';

class LiveHoldPage extends ConsumerStatefulWidget {
  const LiveHoldPage({super.key, required this.id});

  final String id;

  @override
  ConsumerState<LiveHoldPage> createState() => _LiveHoldPageState();
}

class _LiveHoldPageState extends ConsumerState<LiveHoldPage> {
  String? _checked;
  String? _error;
  String? _busy;

  String _signature(Map<String, dynamic> path) {
    final agreement = _record(path['agreement']);
    return [
      path['currentVersion'],
      path['status'],
      agreement['participantAConfirmedAt'],
      agreement['participantBConfirmedAt'],
      for (final plan in _records(path['plans']))
        '${plan['id']}:${plan['version']}:${plan['learnerConfirmedAt']}:${_scheduleOf(plan)?['version']}:${_scheduleOf(plan)?['participantAConfirmedAt']}:${_scheduleOf(plan)?['participantBConfirmedAt']}',
    ].join('|');
  }

  @override
  Widget build(BuildContext context) {
    final query = ref.watch(livePathProvider(widget.id));
    final path = query.value ?? const <String, dynamic>{};
    final me = ref.watch(accountSessionProvider)?.userId ?? '';
    final agreement = _record(path['agreement']);
    final plans = _records(path['plans']);
    final ready = path.isNotEmpty && _canFinalize(path);
    final signature = path.isEmpty ? '' : _signature(path);
    final sessions = plans.fold<int>(
      0,
      (sum, plan) => sum + _version(plan['totalSessions']),
    );
    final blocked = path.isEmpty && (query.isLoading || query.hasError);
    final checked = _checked == signature;
    return FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.study}),
      title: 'Kiểm tra và chốt lịch',
      back: '/paths/${widget.id}',
      children: [
        WaitingRefresh(
          scopes: const {RefreshScope.study},
          interval: const Duration(seconds: 5),
          enabled: _awaitingPeerConfirmation(path, me),
          child: const SizedBox.shrink(),
        ),
        if (query.isLoading && path.isEmpty)
          const LiveBusyNote(label: 'Đang tải lộ trình.'),
        if (query.hasError && path.isEmpty)
          FormNotice(tone: NoticeTone.error, message: errorMessage(query.error)),
        if (query.hasValue && path.isEmpty)
          const EmptyState(
            title: 'Không tìm thấy lộ trình',
            description: 'Lộ trình không còn trên máy chủ hoặc bạn không tham gia.',
          ),
        if (path['lockedVersion'] != null)
          Panel(
            title: 'Lịch đã chốt',
            children: [
              FormNotice(
                tone: NoticeTone.success,
                message:
                    'Hệ thống đã khóa phiên bản ${path['lockedVersion']} và ghi nhận các buổi học.',
              ),
              AppButton(
                label: 'Xem các buổi học',
                variant: ButtonVariant.paper,
                onPressed: () => context.go('/paths/${widget.id}/schedules'),
              ),
            ],
          )
        else if (path.isNotEmpty)
          Panel(
            title: 'Xem lại trước khi chốt',
            children: [
              Copy('Điều khoản v${path['currentVersion']} · $sessions buổi học.'),
              Copy(
                agreement['exchangeType'] == 'TWO_WAY'
                    ? 'Mỗi người sẽ được tạm giữ ${agreement['totalCreditPerUser']} CR cho toàn thỏa thuận.'
                    : 'Người học sẽ được tạm giữ ${agreement['negotiatedCredit']} CR cho toàn lộ trình; người dạy không tạm giữ Credit.',
              ),
              const Copy(
                'Chốt lịch sẽ khóa lịch, tạo các buổi học và tạm giữ Credit. Hệ thống kiểm tra lịch trùng và số dư tại thời điểm chốt.',
              ),
              if (!ready)
                const FormNotice(
                  tone: NoticeTone.info,
                  message:
                      'Cần đủ kế hoạch và xác nhận của người học, điều khoản chung và lịch của cả hai trước khi kiểm tra.',
                ),
              if (_error != null)
                FormNotice(tone: NoticeTone.error, message: _error!),
              if (checked)
                const FormNotice(
                  tone: NoticeTone.success,
                  message:
                      'Đủ điều kiện tại lần kiểm tra vừa rồi. Hệ thống sẽ kiểm tra lại khi bạn chốt lịch.',
                )
              else if (ready)
                const Copy(
                  'Bấm kiểm tra trước. Nút chốt chỉ mở sau khi kiểm tra thành công.',
                  muted: true,
                ),
              AppButton(
                label: _busy == 'check'
                    ? 'Đang kiểm tra...'
                    : 'Kiểm tra điều kiện trên hệ thống',
                variant: checked ? ButtonVariant.paper : ButtonVariant.craft,
                loading: _busy == 'check',
                disabled: !ready || blocked || _busy != null,
                onPressed: () async {
                  setState(() {
                    _busy = 'check';
                    _checked = null;
                    _error = null;
                  });
                  try {
                    final result = await ref
                        .read(authRuntimeProvider)
                        .services
                        .study
                        .validatePath(widget.id);
                    if (!mounted) return;
                    final matched =
                        _version(result['version']) ==
                            _version(path['currentVersion']) &&
                        _version(result['planCount']) == plans.length &&
                        _version(result['scheduleCount']) == plans.length &&
                        result['ready'] == true;
                    setState(() {
                      _checked = matched ? signature : null;
                      _error = matched
                          ? null
                          : 'Kết quả kiểm tra không khớp phiên bản đang mở.';
                    });
                  } catch (error) {
                    if (mounted) setState(() => _error = errorMessage(error));
                  } finally {
                    if (mounted) setState(() => _busy = null);
                  }
                },
              ),
              AppButton(
                label: _busy == 'finalize'
                    ? 'Đang chốt lịch...'
                    : 'Xác nhận chốt lịch và tạm giữ Credit',
                variant: checked ? ButtonVariant.craft : ButtonVariant.paper,
                loading: _busy == 'finalize',
                disabled: !ready || blocked || !checked || _busy != null,
                onPressed: () async {
                  setState(() {
                    _busy = 'finalize';
                    _error = null;
                  });
                  try {
                    await ref.read(authRuntimeProvider).services.study.finalizePath(
                      widget.id,
                      expectedVersion: _version(path['currentVersion']),
                    );
                    ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.study});
                    if (mounted) setState(() => _checked = null);
                  } catch (error) {
                    if (mounted) setState(() => _error = errorMessage(error));
                  } finally {
                    if (mounted) setState(() => _busy = null);
                  }
                },
              ),
              AppButton(
                label: 'Xem lại lịch từng buổi',
                variant: ButtonVariant.paper,
                onPressed: () => context.go('/paths/${widget.id}/schedules'),
              ),
            ],
          ),
      ],
    );
  }
}

class LiveBusyNote extends StatelessWidget {
  const LiveBusyNote({super.key, this.label = 'Đang tải cuộc trao đổi.'});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
        const SizedBox(width: 10),
        Flexible(child: Copy(label)),
      ],
    );
  }
}
