import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_input.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../auth/session/auth_session.dart';
import '../remote/refresh_signal.dart';
import '../remote/remote_load.dart';
import '../messages/messages_data.dart';
import '../skills/schema/skill_schema.dart';
import '../skills/skills_feature.dart';

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

final livePathsProvider = FutureProvider<List<Map<String, dynamic>>>((
  ref,
) async {
  watchRefresh(ref, RefreshScope.study);
  if (ref.watch(sessionSnapshotProvider).phase != SessionPhase.ready) {
    return const [];
  }
  return ref.read(authRuntimeProvider).services.study.myPaths();
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
  return ref.read(authRuntimeProvider).services.study.path(id);
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

String? _proposalFor(WidgetRef ref, String conversationId) {
  if (conversationId.isEmpty) return null;
  for (final item in ref.watch(messagesProvider).conversations) {
    if (item.id == conversationId) return item.proposal;
  }
  return null;
}

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

bool _canSchedule(Map<String, dynamic> path, Map<String, dynamic> plan, String me) =>
    _editablePath(path) &&
    path['status'] == 'CONFIRMED' &&
    plan['teacherId'] == me &&
    plan['status'] == 'CONFIRMED' &&
    plan['learnerConfirmedAt'] != null &&
    plan['schedule'] == null;

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

String? scheduleSlotError(List<DateTime> starts, List<int> minutes) {
  var previousEnd = DateTime.fromMillisecondsSinceEpoch(0);
  final now = DateTime.now();
  for (var i = 0; i < starts.length; i++) {
    final start = starts[i];
    if (!start.isAfter(now)) return 'Buổi ${i + 1} phải ở tương lai.';
    if (start.isBefore(previousEnd)) {
      return 'Các buổi phải theo thứ tự và không trùng nhau.';
    }
    previousEnd = start.add(Duration(minutes: minutes[i]));
  }
  return null;
}

bool _pathStillOpen(Object? status) =>
    status != 'COMPLETED' && status != 'CANCELLED';

DateTime? _parsedDate(Object? value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value);
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

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(accountSessionProvider)?.userId ?? '';
    final paths = ref.watch(livePathsProvider);
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
        if (paths.hasError)
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
        if (paths.hasValue && mine.isEmpty)
          Panel(
            title: 'Thống nhất lộ trình chính thức',
            children: [
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
                key: ValueKey(_type),
                defaults: const {'credit': '20'},
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
                      context.go('/paths/$id');
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
        ),
      ],
    );
  }
}

class _PathSuggestionPanel extends ConsumerStatefulWidget {
  const _PathSuggestionPanel({
    required this.conversationId,
    required this.partnerName,
  });

  final String conversationId;
  final String partnerName;

  @override
  ConsumerState<_PathSuggestionPanel> createState() =>
      _PathSuggestionPanelState();
}

class _PathSuggestionPanelState extends ConsumerState<_PathSuggestionPanel> {
  String _type = 'TWO_WAY';
  String _role = 'Tôi dạy';
  var _saved = false;
  var _sent = false;
  var _busy = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final twoWay = _type == 'TWO_WAY';
    return Panel(
      title: 'Cùng ${widget.partnerName} thiết kế cách học',
      children: [
        const FormNotice(
          tone: NoticeTone.info,
          message:
              'Bạn có thể lưu ý tưởng và gửi gợi ý qua Chat trước khi tạo hoặc sửa lộ trình chính thức ở phía trên.',
        ),
        const Copy(
          'Gợi ý dưới đây chưa tạo kế hoạch chính thức, chưa xác nhận điều khoản hoặc giữ Credit.',
          muted: true,
        ),
        ChoiceGroup(
          label: 'Hình thức mong muốn',
          options: const ['Trao đổi hai chiều', 'Học một chiều'],
          value: twoWay ? 'Trao đổi hai chiều' : 'Học một chiều',
          onChange: (value) => setState(
            () => _type = value == 'Trao đổi hai chiều' ? 'TWO_WAY' : 'ONE_WAY',
          ),
        ),
        if (!twoWay)
          ChoiceGroup(
            label: 'Vai trò mong muốn',
            options: const ['Tôi dạy', 'Tôi học'],
            value: _role,
            onChange: (value) => setState(() => _role = value),
          ),
        DataForm(
          key: ValueKey('$_type$_role'),
          defaults: const {
            'credit': '20',
            'skill': '',
            'goal': '',
            'outline': '',
          },
          fields: [
            DataField(
              name: 'credit',
              label: twoWay
                  ? 'Credit cam kết mỗi người'
                  : 'Credit gợi ý toàn lộ trình',
              rule: creditRule(twoWay ? 20 : 0, twoWay),
              numeric: true,
            ),
            DataField(
              name: 'skill',
              label: twoWay || _role == 'Tôi dạy'
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
            DataField(
              name: 'outline',
              label: 'Nội dung dự kiến từng buổi',
              rule: (value) {
                final lines = [
                  for (final line in value.split('\n'))
                    if (line.trim().isNotEmpty) line.trim(),
                ];
                if (lines.isEmpty ||
                    lines.length > 100 ||
                    lines.any((line) => line.length < 5)) {
                  return 'Mỗi dòng là một buổi, mô tả ít nhất 5 ký tự; tối đa 100 buổi.';
                }
                return null;
              },
              multiline: true,
              hint: 'Mỗi dòng là một buổi. Nội dung này dùng để thương lượng.',
            ),
          ],
          submitLabel: _busy ? 'Đang gửi...' : 'Gửi gợi ý qua Chat',
          extra: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 8,
            children: [
              if (_saved)
                const FormNotice(
                  tone: NoticeTone.success,
                  message: 'Bản nháp đã lưu trong phiên này.',
                ),
              if (_sent)
                const FormNotice(
                  tone: NoticeTone.success,
                  message:
                      'Gợi ý đã được gửi trong Chat; chưa phải xác nhận lộ trình.',
                ),
              if (_error != null)
                FormNotice(tone: NoticeTone.error, message: _error!),
              AppButton(
                label: 'Lưu bản nháp',
                variant: ButtonVariant.paper,
                disabled: _busy,
                onPressed: () => setState(() {
                  _saved = true;
                  _error = null;
                }),
              ),
            ],
          ),
          onSubmit: (values) async {
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
                messageText: _suggestionMessage(values, twoWay, _role),
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

String _suggestionMessage(
  Map<String, String> values,
  bool twoWay,
  String role,
) {
  final lessons = [
    for (final line in (values['outline'] ?? '').split('\n'))
      if (line.trim().isNotEmpty) line.trim(),
  ];
  final teach = twoWay || role == 'Tôi dạy';
  return [
    'GỢI Ý LỘ TRÌNH · CHƯA XÁC NHẬN',
    'Hình thức: ${twoWay ? 'Trao đổi hai chiều' : 'Học một chiều'}',
    'Chiều trao đổi: ${teach ? 'Tôi dạy → bạn học' : 'Tôi mong muốn học từ bạn'}',
    'Kỹ năng: ${values['skill']}',
    'Mục tiêu: ${values['goal']}',
    'Credit gợi ý cho toàn thỏa thuận: ${values['credit']}${twoWay ? ' mỗi người' : ''}',
    for (var i = 0; i < lessons.length; i++) 'Buổi ${i + 1}: ${lessons[i]}',
    'Đây là nội dung thương lượng trong Chat. Người dạy tự tạo kế hoạch; kế hoạch và lịch cần xác nhận riêng. Chưa giữ Credit.',
  ].join('\n');
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
    final proposal = _proposalFor(ref, _text(path['conversationId']));
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
          enabled: path.isNotEmpty && _pathStillOpen(path['status']),
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
              proposal == null ? '/messages' : '/chat/$proposal',
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
        if (plan != null)
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
              for (final item in outline)
                Copy('${item['sessionNo']}. ${item['content']}'),
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
                      ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.study});
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
      ],
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
  final _outline = AppField(validator: _outlineRule);
  var _seeded = false;
  var _submitting = false;
  String? _formError;

  void _onOutlineChanged() {
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    _outline.addListener(_onOutlineChanged);
  }

  @override
  void dispose() {
    _outline.removeListener(_onOutlineChanged);
    _goal.dispose();
    _outline.dispose();
    super.dispose();
  }

  void _seed(Map<String, dynamic>? plan) {
    if (_seeded) return;
    _seeded = true;
    _goal.text = plan?['learningGoal']?.toString() ?? '';
    final lines = [
      for (final item in _records(plan?['sessionOutline']))
        _text(item['content']).trim(),
    ].where((line) => line.isNotEmpty);
    _outline.text = lines.join('\n');
  }

  Future<void> _submitPlan({
    required String skillId,
    required Map<String, dynamic>? plan,
  }) async {
    if (_submitting) return;
    if (!validateFields([_goal, _outline])) {
      setState(() => _formError = null);
      return;
    }
    final lines = [
      for (final line in _outline.text.split('\n'))
        if (line.trim().isNotEmpty) line.trim(),
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
    final catalog = ref.watch(skillCatalogProvider).value ?? const <SkillRecord>[];
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
    final selected = _skillId ?? plan?['skillId']?.toString();
    final names = {for (final skill in catalog) skill.id: skill.name};
    if (canEdit && catalog.isNotEmpty) _seed(plan);
    return FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.study}),
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
        if (canEdit && catalog.isEmpty)
          const EmptyState(
            title: 'Chưa có kỹ năng trong danh mục',
            description: 'Kế hoạch cần một kỹ năng đã có trên máy chủ.',
          ),
        if (canEdit && catalog.isNotEmpty)
          Panel(
            title: 'Thiết kế hành trình học',
            children: [
              ChoiceGroup(
                label: 'Kỹ năng bạn dạy',
                value: names[selected] ?? catalog.first.name,
                options: [for (final skill in catalog) skill.name],
                onChange: (value) {
                  final match = catalog.where((skill) => skill.name == value);
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
              AppInput(
                field: _outline,
                label: 'Nội dung từng buổi',
                multiline: true,
                hint: 'Mỗi dòng là một buổi, tối đa 100 buổi.',
                editable: !_submitting,
              ),
              Copy(
                '${[
                  for (final line in _outline.text.split('\n'))
                    if (line.trim().isNotEmpty) line,
                ].length} buổi',
                muted: true,
              ),
              if (_formError != null)
                FormNotice(tone: NoticeTone.error, message: _formError!),
              AppButton(
                label: _submitting ? 'Đang gửi...' : 'Gửi kế hoạch',
                variant: ButtonVariant.craft,
                loading: _submitting,
                onPressed: () => _submitPlan(
                  skillId: selected ?? catalog.first.id,
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

String? _outlineRule(String value) {
  final lines = [
    for (final line in value.split('\n'))
      if (line.trim().isNotEmpty) line.trim(),
  ];
  if (lines.isEmpty) return 'Nhập nội dung từng buổi.';
  if (lines.length > 100 || lines.any((line) => line.length > 2000)) {
    return 'Mỗi dòng là một buổi, không để trống, tối đa 100 buổi và 2.000 ký tự/buổi.';
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
          enabled: path.isNotEmpty && _pathStillOpen(path['status']),
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
          const Copy(
            'Giờ hiển thị theo múi giờ thiết bị. Lịch cần cả hai xác nhận; chỉ khi chốt lộ trình mới tạo buổi học và tạm giữ Credit.',
            muted: true,
          ),
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
    final partnerConfirmed = schedule == null
        ? false
        : (path['participantAId'] == me
              ? schedule['participantBConfirmedAt']
              : schedule['participantAConfirmedAt']) !=
          null;
    final sessions = _records(plan['sessions']);
    return Panel(
      title: title,
      children: [
        Copy(
          '${plan['teacherId'] == me ? 'Bạn dạy' : 'Bạn học'} · ${_version(plan['totalSessions'])} buổi',
        ),
        if (schedule == null)
          const Copy(
            'Chưa có đề xuất lịch. Người dạy của kế hoạch này sẽ đề xuất lịch.',
            muted: true,
          ),
        if (schedule != null) ...[
          Copy(
            'Lịch v${schedule['version']} · ${_scheduleStatusLabel[schedule['status']] ?? schedule['status']}',
          ),
          for (final item in _records(schedule['items']))
            Copy(
              'Buổi ${item['sessionNo']}: ${_when(item['startAt'])} – ${_when(item['endAt'])}',
            ),
          Copy(
            'Bạn: ${_confirmedBy(path, schedule, me) ? 'đã xác nhận' : 'chưa xác nhận'} · Đối tác: ${partnerConfirmed ? 'đã xác nhận' : 'chưa xác nhận'}',
          ),
          if (_canConfirmSchedule(path, plan, me))
            AppButton(
              label: 'Xác nhận lịch v${schedule['version']}',
              loading: busy == schedule['id'],
              disabled: busy != null,
              onPressed: () => onConfirm(schedule),
            ),
        ],
        if (_canSchedule(path, plan, me))
          AppButton(
            label: 'Đề xuất lịch tôi dạy',
            variant: ButtonVariant.paper,
            onPressed: () => context.go('/paths/$pathId/schedules/${plan['id']}'),
          ),
        if (sessions.isNotEmpty) ...[
          const Copy('Buổi học đã tạo:'),
          for (final session in sessions) ...[
            Copy(
              'Buổi ${session['sessionNo']}: ${_when(session['startAt'])} · ${_sessionStatusLabel[session['status']] ?? session['status']}',
            ),
            if (isLiveId(_text(session['id'])))
              AppButton(
                label: 'Mở buổi ${session['sessionNo']}',
                variant: ButtonVariant.paper,
                onPressed: () =>
                    context.go('/learning-sessions/${session['id']}'),
              ),
          ],
        ],
      ],
    );
  }
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
    final ready = path.isNotEmpty && plan != null && _canSchedule(path, plan, me);
    return FeaturePage(
      onRefresh: () => pullRefresh(ref, const {RefreshScope.study}),
      title: 'Đề xuất lịch tôi dạy',
      back: '/paths/$id/schedules',
      children: [
        if (query.isLoading && plan == null)
          const LiveBusyNote(label: 'Đang tải kế hoạch.'),
        if (query.hasError && plan == null)
          FormNotice(tone: NoticeTone.error, message: errorMessage(query.error)),
        if (!query.isLoading && !ready)
          const EmptyState(
            title: 'Chưa thể đề xuất lịch',
            description:
                'Chỉ người dạy đề xuất lịch sau khi kế hoạch và điều khoản đã xác nhận. Mỗi kế hoạch có một đề xuất lịch cho phiên bản hiện tại.',
          ),
        if (ready)
          Panel(
            title: 'Lịch cho ${_version(plan['totalSessions'])} buổi',
            children: [
              Copy(
                'Nhập giờ theo múi giờ thiết bị: ${_deviceZone()}. Định dạng 2026-11-20T19:00. Lịch gửi đi chưa thể sửa trực tiếp.',
                muted: true,
              ),
              _ScheduleProposalForm(
                key: ValueKey('${path['currentVersion']}:${plan['version']}'),
                pathId: id,
                planId: planId,
                planVersion: _version(plan['version']),
                outline: outline,
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
  });

  final String pathId;
  final String planId;
  final int planVersion;
  final List<Map<String, dynamic>> outline;

  @override
  ConsumerState<_ScheduleProposalForm> createState() =>
      _ScheduleProposalFormState();
}

class _ScheduleProposalFormState extends ConsumerState<_ScheduleProposalForm> {
  late final List<AppField> _starts = [
    for (var i = 0; i < widget.outline.length; i++)
      AppField(validator: _localStartRule),
  ];
  late final List<AppField> _minutes = [
    for (var i = 0; i < widget.outline.length; i++)
      AppField(text: '60', validator: integerRule(60, 180)),
  ];
  String? _error;
  var _submitting = false;

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

  Future<void> _submit() async {
    if (_submitting) return;
    final valid = validateFields([..._starts, ..._minutes]);
    if (!valid) return;
    final starts = [
      for (final field in _starts) parseLocalDateTime(field.text.trim())!,
    ];
    final minutes = [for (final field in _minutes) int.parse(field.text.trim())];
    final invalid = scheduleSlotError(starts, minutes);
    if (invalid != null) {
      setState(() => _error = invalid);
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(authRuntimeProvider).services.study.proposeSchedule(
        widget.planId,
        {
          'expectedPlanVersion': widget.planVersion,
          'items': [
            for (var i = 0; i < starts.length; i++)
              {
                'sessionNo': i + 1,
                'startAt': starts[i].toUtc().toIso8601String(),
                'endAt': starts[i]
                    .add(Duration(minutes: minutes[i]))
                    .toUtc()
                    .toIso8601String(),
              },
          ],
        },
      );
      ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.study});
      if (mounted) context.go('/paths/${widget.pathId}/schedules');
    } catch (error) {
      if (mounted) setState(() => _error = errorMessage(error));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 14,
      children: [
        for (final (index, lesson) in widget.outline.indexed) ...[
          Text(_lessonLabel(lesson, index), style: FeatureStyles.strong),
          AppInput(
            field: _starts[index],
            label: 'Ngày giờ bắt đầu',
            placeholder: 'YYYY-MM-DDTHH:mm',
            hint: 'Ví dụ 2026-11-20T19:00',
            editable: !_submitting,
          ),
          AppInput(
            field: _minutes[index],
            label: 'Thời lượng (phút)',
            editable: !_submitting,
            keyboardType: TextInputType.number,
          ),
        ],
        if (_error != null) FormNotice(tone: NoticeTone.error, message: _error!),
        AppButton(
          label: _submitting ? 'Đang gửi...' : 'Gửi đề xuất lịch',
          variant: ButtonVariant.craft,
          loading: _submitting,
          onPressed: _submit,
        ),
      ],
    );
  }
}

String? _localStartRule(String value) {
  final date = parseLocalDateTime(value.trim());
  if (date == null) return 'Nhập ngày giờ theo YYYY-MM-DDTHH:mm.';
  if (!date.isAfter(DateTime.now())) return 'Buổi học phải ở tương lai.';
  return null;
}

String _deviceZone() => DateTime.now().timeZoneOffset.inHours == 7
    ? 'Asia/Ho_Chi_Minh'
    : 'Asia/Ho_Chi_Minh';

String _lessonLabel(Map<String, dynamic> lesson, int index) {
  final number = _version(lesson['sessionNo']);
  final no = number == 0 ? index + 1 : number;
  final content = _text(lesson['content']).trim().replaceFirst(
    RegExp('^buổi\\s*$no\\s*[:.\\-]\\s*', caseSensitive: false),
    '',
  );
  return content.isEmpty ? 'Buổi $no' : 'Buổi $no: $content';
}

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
          enabled: path.isNotEmpty && _pathStillOpen(path['status']),
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

String _when(Object? value) {
  final date = _parsedDate(value);
  return date == null ? '' : viDateTime(date);
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
