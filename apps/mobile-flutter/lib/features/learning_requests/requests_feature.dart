import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../core/theme/tokens.dart';
import '../../core/http/app_error.dart';
import '../../core/http/http_client.dart';
import '../../core/toast/toast.dart';
import '../auth/session/auth_session.dart';
import '../remote/remote_load.dart';
import '../skills/schema/skill_schema.dart';
import '../skills/skills_feature.dart';
import 'service/learning_requests_service.dart';
import 'schema/learning_request_schema.dart';

typedef PreferredSlot = ({DateTime startAt, DateTime endAt});

class OwnRequest {
  const OwnRequest({
    required this.id,
    required this.title,
    required this.skill,
    required this.description,
    required this.goal,
    required this.level,
    required this.status,
    this.skillId,
    this.tags = const [],
    this.preferredSlots = const [],
    this.reason,
    this.version = 1,
  });

  final String id;
  final String title;
  final String skill;
  final String? skillId;
  final List<String> tags;
  final List<PreferredSlot> preferredSlots;
  final String description;
  final String goal;
  final String level;
  final String status;
  final String? reason;
  final int version;

  OwnRequest withStatus(String status) => OwnRequest(
    id: id,
    title: title,
    skill: skill,
    skillId: skillId,
    tags: tags,
    preferredSlots: preferredSlots,
    description: description,
    goal: goal,
    level: level,
    status: status,
    reason: reason,
    version: version,
  );
}

OwnRequest _ownRequest(Map<String, dynamic> json, Map<String, String> names) {
  final skillId = asString(json['skillId']);
  return OwnRequest(
    id: asString(json['id']),
    title: asString(json['title']),
    skill: names[skillId] ?? skillId,
    skillId: skillId,
    description: asText(json['description']),
    goal: asText(json['learningGoal']),
    level: asOptionalString(json['currentLevel']) ?? 'NONE',
    status: asString(json['status']),
    reason: asOptionalString(json['moderationRejectReason']),
    version: asInt(json['version']),
    preferredSlots: [
      for (final slot in asList(json['preferredSlots'], asMap))
        (
          startAt: DateTime.parse(asString(slot['startAt'])).toLocal(),
          endAt: DateTime.parse(asString(slot['endAt'])).toLocal(),
        ),
    ],
  );
}

class RequestsNotifier extends Notifier<List<OwnRequest>> {
  var _ticket = 0;

  @override
  List<OwnRequest> build() {
    final phase = ref.watch(sessionSnapshotProvider).phase;
    final userId = ref.watch(accountProvider).value?.userId;
    if (phase == SessionPhase.ready && userId != null) {
      _ticket++;
      _reload(_ticket);
    }
    return const [];
  }

  Future<void> _reload(int ticket) async {
    try {
      final services = ref.read(authRuntimeProvider).services;
      final records = await drainPages(
        (cursor) => services.learningRequests.mine(cursor: cursor, limit: 50),
      );
      final catalog = await ref.read(skillCatalogProvider.future);
      final names = {for (final skill in catalog) skill.id: skill.name};
      if (!ref.mounted || ticket != _ticket) return;
      state = [for (final record in records) _ownRequest(record, names)];
    } catch (_) {
      if (!ref.mounted || ticket != _ticket) return;
      state = const [];
    }
  }

  OwnRequest? find(String? id) => state.where((r) => r.id == id).firstOrNull;

  LearningRequestDraft _draft(OwnRequest request) => LearningRequestDraft(
    title: request.title,
    skillId: request.skillId ?? '',
    description: request.description,
    learningGoal: request.goal,
    currentLevel: request.level,
    preferredSlots: request.preferredSlots,
  );

  Future<({String? id, String? error})> save(
    OwnRequest request, {
    required bool creating,
  }) async {
    if (request.skillId == null || request.skillId!.isEmpty) {
      return (id: null, error: 'Chọn kỹ năng trong danh mục.');
    }
    try {
      final api = ref.read(authRuntimeProvider).services.learningRequests;
      final saved = creating
          ? await api.create(_draft(request))
          : await api.edit(
              request.id,
              _draft(request),
              expectedVersion: request.version,
            );
      final ticket = ++_ticket;
      await _reload(ticket);
      return (id: asString(saved['id']), error: null);
    } catch (error) {
      return (id: null, error: errorMessage(error));
    }
  }

  Future<String?> publish(OwnRequest request) => _versioned(
    (api) => api.publish(request.id, expectedVersion: request.version),
  );

  Future<String?> cancel(OwnRequest request) => _versioned(
    (api) => api.cancel(request.id, expectedVersion: request.version),
  );

  Future<String?> _versioned(
    Future<Map<String, dynamic>> Function(LearningRequestsService api) run,
  ) async {
    try {
      final api = ref.read(authRuntimeProvider).services.learningRequests;
      await run(api);
      final ticket = ++_ticket;
      await _reload(ticket);
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }
}

final requestsProvider = NotifierProvider<RequestsNotifier, List<OwnRequest>>(
  RequestsNotifier.new,
);

const _editable = ['DRAFT', 'OPEN', 'PENDING_MODERATION', 'REJECTED'];
const _maxPreferredSlots = 5;

class MyRequestsScreen extends ConsumerStatefulWidget {
  const MyRequestsScreen({super.key});

  @override
  ConsumerState<MyRequestsScreen> createState() => _MyRequestsScreenState();
}

class _MyRequestsScreenState extends ConsumerState<MyRequestsScreen> {
  String _filter = 'Tất cả';

  @override
  Widget build(BuildContext context) {
    final items = ref
        .watch(requestsProvider)
        .where((r) => _filter == 'Tất cả' || r.status == _filter)
        .toList();
    return FeaturePage(
      title: 'Yêu cầu học của tôi',
      back: '/discover',
      subtitle: 'Quản lý nhu cầu học, bài nháp và phản hồi kiểm duyệt.',
      children: [
        const RouteButton(href: '/requests/new', label: 'Đăng yêu cầu học'),
        ChoiceGroup(
          label: 'Trạng thái',
          options: const [
            'Tất cả',
            'DRAFT',
            'PENDING_MODERATION',
            'OPEN',
            'REJECTED',
            'MATCHED',
            'CANCELLED',
          ],
          value: _filter,
          onChange: (value) => setState(() => _filter = value),
        ),
        for (final r in items)
          Panel(
            title: r.title,
            children: [
              StatusBadge(r.status),
              Copy(r.goal),
              RouteButton(
                secondary: true,
                href: '/requests/${r.id}',
                label: 'Xem yêu cầu',
              ),
            ],
          ),
        if (items.isEmpty)
          const EmptyState(
            title: 'Chưa có yêu cầu ở trạng thái này',
            description: 'Thử bộ lọc khác hoặc tạo yêu cầu mới.',
          ),
      ],
    );
  }
}

class RequestEditorScreen extends ConsumerStatefulWidget {
  const RequestEditorScreen({super.key, this.id});

  final String? id;

  @override
  ConsumerState<RequestEditorScreen> createState() =>
      _RequestEditorScreenState();
}

class _RequestEditorScreenState extends ConsumerState<RequestEditorScreen> {
  String? _loadedKey;
  List<PreferredSlot> _slots = const [];

  void _sync(OwnRequest? request) {
    if (widget.id != null && request == null) return;
    final key = request == null ? 'new' : '${request.id}@${request.version}';
    if (_loadedKey == key) return;
    _loadedKey = key;
    _slots = List<PreferredSlot>.of(request?.preferredSlots ?? const []);
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(requestsProvider);
    final catalog =
        ref.watch(skillCatalogProvider).value ?? const <SkillRecord>[];
    final catalogNames = [for (final item in catalog) item.name];
    final notifier = ref.read(requestsProvider.notifier);
    final request = notifier.find(widget.id);
    _sync(request);
    return FeaturePage(
      title: widget.id != null ? 'Sửa yêu cầu học' : 'Tạo yêu cầu học',
      back: '/requests',
      children: [
        if (widget.id != null &&
            (request == null || !_editable.contains(request.status)))
          const EmptyState(
            title: 'Không thể chỉnh sửa',
            description: 'Yêu cầu không còn ở trạng thái cho phép sửa.',
          )
        else
          Panel(
            title: 'Bạn muốn học điều gì?',
            children: [
              DataForm(
                defaults: request != null
                    ? {
                        'title': request.title,
                        'skill': request.skill,
                        'description': request.description,
                        'goal': request.goal,
                        'level': request.level,
                        'tags': request.tags.join(', '),
                      }
                    : const {'level': 'BEGINNER'},
                fields: [
                  DataField(
                    name: 'title',
                    label: 'Tiêu đề',
                    rule: textRule(10, 120),
                  ),
                  DataField(
                    name: 'skill',
                    label: 'Kỹ năng muốn học',
                    rule: (v) => catalogNames.contains(v)
                        ? null
                        : 'Chọn một kỹ năng.',
                    choices: catalogNames,
                  ),
                  DataField(
                    name: 'description',
                    label: 'Mô tả nhu cầu',
                    rule: textRule(20, 3000),
                    multiline: true,
                  ),
                  DataField(
                    name: 'goal',
                    label: 'Mục tiêu học tập',
                    rule: textRule(10, 1000),
                    multiline: true,
                  ),
                  DataField(
                    name: 'level',
                    label: 'Trình độ hiện tại',
                    rule: textRule(1, 30),
                    choices: const [
                      'NONE',
                      'BEGINNER',
                      'INTERMEDIATE',
                      'ADVANCED',
                    ],
                  ),
                  DataField(
                    name: 'tags',
                    label: 'Tag bổ sung (không bắt buộc)',
                    hint:
                        'Phân cách bằng dấu phẩy. Dùng tên kỹ năng trong danh mục phía trên.',
                    rule: (_) => null,
                  ),
                ],
                extra: PreferredSlotsEditor(
                  slots: _slots,
                  onChanged: (slots) => setState(() => _slots = slots),
                ),
                submitLabel: 'Lưu bản nháp',
                onSubmit: (v) async {
                  final skill = catalog
                      .where((item) => item.name == v['skill'])
                      .firstOrNull;
                  final result = await notifier.save(
                    OwnRequest(
                      id: request?.id ?? '',
                      title: v['title']!,
                      skill: v['skill']!,
                      skillId: skill?.id,
                      preferredSlots: _slots,
                      description: v['description']!,
                      goal: v['goal']!,
                      level: v['level']!,
                      status: request?.status ?? 'DRAFT',
                      version: request?.version ?? 1,
                    ),
                    creating: request == null,
                  );
                  if (result.error != null) return result.error;
                  if (context.mounted) {
                    context.pushReplacement('/requests/${result.id}');
                  }
                  return null;
                },
              ),
              const Copy(
                'Đăng bài ở bước tiếp theo. Mọi lần đăng hoặc sửa bài đều cần kiểm tra kiểm duyệt lại.',
                muted: true,
              ),
            ],
          ),
      ],
    );
  }
}

class PreferredSlotsEditor extends StatefulWidget {
  const PreferredSlotsEditor({
    super.key,
    required this.slots,
    required this.onChanged,
  });

  final List<PreferredSlot> slots;
  final ValueChanged<List<PreferredSlot>> onChanged;

  @override
  State<PreferredSlotsEditor> createState() => _PreferredSlotsEditorState();
}

class _PreferredSlotsEditorState extends State<PreferredSlotsEditor> {
  String? _error;

  Future<void> _add() async {
    final now = DateTime.now();
    final start = await _pickMoment(
      context,
      dateHelp: 'Ngày bắt đầu',
      timeHelp: 'Giờ bắt đầu',
      first: now,
      initial: now.add(const Duration(hours: 1)),
    );
    if (start == null || !mounted) return;
    if (!start.isAfter(DateTime.now())) {
      setState(() => _error = 'Giờ bắt đầu phải ở tương lai.');
      return;
    }
    final end = await _pickMoment(
      context,
      dateHelp: 'Ngày kết thúc',
      timeHelp: 'Giờ kết thúc',
      first: start,
      initial: start.add(const Duration(hours: 2)),
    );
    if (end == null || !mounted) return;
    if (!end.isAfter(start)) {
      setState(() => _error = 'Giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }
    setState(() => _error = null);
    widget.onChanged([
      ...widget.slots,
      (startAt: start, endAt: end),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final full = widget.slots.length >= _maxPreferredSlots;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        Text(
          'Khoảng thời gian ưu tiên (không bắt buộc)',
          style: nunito(
            TypeScale.body,
            weight: FontWeight.w600,
            color: Palette.inkSoft,
          ),
        ),
        if (widget.slots.isEmpty)
          const Copy(
            'Chưa chọn khoảng nào. Bấm thêm để chọn ngày và giờ.',
            muted: true,
          ),
        for (var index = 0; index < widget.slots.length; index++)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Palette.white,
              border: Border.all(color: Palette.border),
              borderRadius: BorderRadius.circular(Radii.control),
            ),
            child: Row(
              spacing: 8,
              children: [
                Expanded(child: Text(_slotLabel(widget.slots[index]))),
                AppButton(
                  label: 'Xóa',
                  size: ButtonSize.sm,
                  variant: ButtonVariant.paper,
                  onPressed: () {
                    setState(() => _error = null);
                    widget.onChanged([
                      for (var i = 0; i < widget.slots.length; i++)
                        if (i != index) widget.slots[i],
                    ]);
                  },
                ),
              ],
            ),
          ),
        if (!full)
          Align(
            alignment: Alignment.centerLeft,
            child: AppButton(
              label: 'Thêm khoảng',
              size: ButtonSize.sm,
              variant: ButtonVariant.paper,
              onPressed: _add,
            ),
          ),
        Copy(
          full
              ? 'Đã đủ $_maxPreferredSlots khoảng. Đây chỉ là giờ ưu tiên, chưa chốt lịch.'
              : 'Tối đa $_maxPreferredSlots khoảng theo giờ thiết bị. Đây chỉ là giờ ưu tiên, chưa chốt lịch.',
          muted: true,
        ),
        if (_error != null)
          FormNotice(tone: NoticeTone.error, message: _error!),
      ],
    );
  }
}

Future<DateTime?> _pickMoment(
  BuildContext context, {
  required String dateHelp,
  required String timeHelp,
  required DateTime first,
  required DateTime initial,
}) async {
  final firstDay = DateTime(first.year, first.month, first.day);
  final lastDate = firstDay.add(const Duration(days: 366));
  final initialDay = DateTime(initial.year, initial.month, initial.day);
  final initialDate = initialDay.isBefore(firstDay)
      ? firstDay
      : (initialDay.isAfter(lastDate) ? lastDate : initialDay);
  final date = await showDatePicker(
    context: context,
    helpText: dateHelp,
    cancelText: 'Hủy',
    confirmText: 'Chọn',
    initialDate: initialDate,
    firstDate: firstDay,
    lastDate: lastDate,
  );
  if (date == null || !context.mounted) return null;
  final time = await showTimePicker(
    context: context,
    helpText: timeHelp,
    cancelText: 'Hủy',
    confirmText: 'Chọn',
    initialTime: TimeOfDay.fromDateTime(initial),
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
      child: child ?? const SizedBox.shrink(),
    ),
  );
  if (time == null) return null;
  return DateTime(date.year, date.month, date.day, time.hour, time.minute);
}

String _slotLabel(PreferredSlot slot) {
  String one(DateTime value) {
    final date = value.toLocal();
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '$day/$month/${date.year} $hour:$minute';
  }

  return '${one(slot.startAt)} → ${one(slot.endAt)}';
}

class OwnRequestScreen extends ConsumerStatefulWidget {
  const OwnRequestScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<OwnRequestScreen> createState() => _OwnRequestScreenState();
}

class _OwnRequestScreenState extends ConsumerState<OwnRequestScreen> {
  bool _cancel = false;

  @override
  Widget build(BuildContext context) {
    final id = widget.id;
    ref.watch(requestsProvider);
    final notifier = ref.read(requestsProvider.notifier);
    final request = notifier.find(id);
    return FeaturePage(
      title: 'Chi tiết yêu cầu của tôi',
      back: '/requests',
      children: request == null
          ? const [
              EmptyState(
                title: 'Không tìm thấy yêu cầu',
                description: 'Yêu cầu không có trong bản xem thử.',
              ),
            ]
          : [
              Panel(
                title: request.title,
                children: [
                  StatusBadge(request.status),
                  Copy('${request.skill} · ${uiLabel(request.level)}'),
                  Copy(request.description),
                  Copy('Mục tiêu: ${request.goal}'),
                  if (request.tags.isNotEmpty)
                    Copy('Tag: ${request.tags.join(', ')}'),
                  for (final slot in request.preferredSlots)
                    Copy(
                      'Ưu tiên: ${viDateTime(slot.startAt)} → ${viDateTime(slot.endAt)} (chưa chốt lịch)',
                    ),
                  if (request.reason != null)
                    FormNotice(
                      tone: NoticeTone.error,
                      message: 'Lý do từ chối: ${request.reason}',
                    ),
                  if (request.status == 'PENDING_MODERATION')
                    const FormNotice(
                      tone: NoticeTone.info,
                      message: 'Bài đang chờ duyệt và chưa nhận đề xuất mới.',
                    ),
                  if (request.status == 'MATCHED')
                    const FormNotice(
                      tone: NoticeTone.info,
                      message:
                          'Lịch đã khóa. Hãy sử dụng đổi lịch hoặc báo cáo trong lộ trình.',
                    ),
                ],
              ),
              if (_editable.contains(request.status))
                RouteButton(
                  secondary: true,
                  href: '/requests/$id/edit',
                  label: 'Chỉnh sửa yêu cầu',
                ),
              if (request.status == 'DRAFT')
                AppButton(
                  label: 'Đăng yêu cầu',
                  variant: ButtonVariant.craft,
                  onPressed: () async {
                    final error = await notifier.publish(request);
                    if (error != null) {
                      ref
                          .read(toastProvider.notifier)
                          .show(error, ToastTone.error);
                    }
                  },
                ),
              if (request.status == 'OPEN')
                const RouteButton(
                  href: '/proposals',
                  label: 'Xem đề xuất nhận được',
                ),
              if (!const ['MATCHED', 'CANCELLED', 'EXPIRED'].contains(request.status))
                AppButton(
                  label: 'Hủy yêu cầu',
                  variant: ButtonVariant.paper,
                  onPressed: () => setState(() => _cancel = true),
                ),
              if (_cancel)
                Panel(
                  title: 'Hủy yêu cầu này?',
                  children: [
                    const Copy(
                      'Lịch sử đề xuất được giữ lại. Bài sẽ không nhận đề xuất mới.',
                    ),
                    AppButton(
                      label: 'Xác nhận hủy',
                      onPressed: () async {
                        final error = await notifier.cancel(request);
                        if (!mounted) return;
                        if (error != null) {
                          ref
                              .read(toastProvider.notifier)
                              .show(error, ToastTone.error);
                          return;
                        }
                        setState(() => _cancel = false);
                      },
                    ),
                    AppButton(
                      label: 'Giữ yêu cầu',
                      variant: ButtonVariant.paper,
                      onPressed: () => setState(() => _cancel = false),
                    ),
                  ],
                ),
            ],
    );
  }
}
