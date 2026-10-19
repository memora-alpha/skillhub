import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../auth/session/auth_session.dart';
import '../skills/skills_feature.dart';

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
  );
}

const _initialRequests = [
  OwnRequest(
    id: 'my-react',
    title: 'Học React để xây dựng ứng dụng',
    skill: 'React',
    description:
        'Tôi đã biết JavaScript cơ bản và muốn thực hành React qua một dự án nhỏ.',
    goal: 'Tự xây dựng ứng dụng quản lý công việc với React.',
    level: 'BEGINNER',
    status: 'OPEN',
  ),
  OwnRequest(
    id: 'request-rejected',
    title: 'Tìm người hướng dẫn thiết kế',
    skill: 'UI/UX',
    description: 'Muốn cải thiện quy trình thiết kế giao diện sản phẩm.',
    goal: 'Thiết kế một bộ giao diện mobile nhất quán.',
    level: 'BEGINNER',
    status: 'REJECTED',
    reason:
        'Vui lòng bỏ thông tin quảng cáo ngoài nền tảng và mô tả rõ mục tiêu học tập.',
  ),
  OwnRequest(
    id: 'request-matched',
    title: 'Luyện tiếng Anh giao tiếp',
    skill: 'Tiếng Anh',
    description:
        'Luyện giao tiếp tiếng Anh cho các tình huống công việc thực tế.',
    goal: 'Thuyết trình một dự án bằng tiếng Anh.',
    level: 'INTERMEDIATE',
    status: 'MATCHED',
  ),
];

class RequestsNotifier extends Notifier<List<OwnRequest>> {
  @override
  List<OwnRequest> build() {
    ref.watch(sessionSnapshotProvider.select((s) => s.generation));
    return _initialRequests;
  }

  OwnRequest? find(String? id) => state.where((r) => r.id == id).firstOrNull;

  void save(OwnRequest request) =>
      state = [request, ...state.where((r) => r.id != request.id)];
}

final requestsProvider = NotifierProvider<RequestsNotifier, List<OwnRequest>>(
  RequestsNotifier.new,
);

/// Accepts `YYYY-MM-DD HH:mm` (the documented hint) as well as the `T` form.
DateTime? _parseSlotTime(String value) =>
    parseLocalDateTime(value.trim().replaceFirst(' ', 'T'));

List<PreferredSlot>? parsePreferredSlots(String value, [DateTime? now]) {
  final current = now ?? DateTime.now();
  final text = value.trim();
  final rows = text.isEmpty ? const <String>[] : text.split(RegExp(r'\n+'));
  if (rows.length > 5) return null;
  final slots = <PreferredSlot>[];
  for (final row in rows) {
    final parts = row.split('→').map((v) => v.trim()).toList();
    if (parts.length != 2) return null;
    final from = _parseSlotTime(parts[0]);
    final to = _parseSlotTime(parts[1]);
    if (from == null || to == null || !from.isAfter(current) || !to.isAfter(from)) {
      return null;
    }
    slots.add((startAt: from, endAt: to));
  }
  return slots;
}

String formatPreferredSlots(List<PreferredSlot> slots) => slots
    .map(
      (s) =>
          '${localDateInput(s.startAt).replaceFirst('T', ' ')} → ${localDateInput(s.endAt).replaceFirst('T', ' ')}',
    )
    .join('\n');

const _editable = ['DRAFT', 'OPEN', 'PENDING_MODERATION', 'REJECTED'];

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

class RequestEditorScreen extends ConsumerWidget {
  const RequestEditorScreen({super.key, this.id});

  final String? id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(requestsProvider);
    final notifier = ref.read(requestsProvider.notifier);
    final request = notifier.find(id);
    return FeaturePage(
      title: id != null ? 'Sửa yêu cầu học' : 'Tạo yêu cầu học',
      back: '/requests',
      children: [
        if (id != null &&
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
                        'preferredSlots': formatPreferredSlots(
                          request.preferredSlots,
                        ),
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
                    rule: (v) => v.isEmpty ? 'Chọn một kỹ năng.' : null,
                    choices: skillCatalog,
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
                    rule: (value) {
                      final v = value.trim();
                      final tags = v.split(',');
                      return v.isEmpty ||
                              (tags.length <= 10 &&
                                  tags.every(
                                    (tag) => skillCatalog.any(
                                      (name) =>
                                          name.toLowerCase() ==
                                          tag.trim().toLowerCase(),
                                    ),
                                  ))
                          ? null
                          : 'Tối đa 10 tag trong danh mục kỹ năng.';
                    },
                  ),
                  DataField(
                    name: 'preferredSlots',
                    label: 'Khoảng thời gian ưu tiên (không bắt buộc)',
                    multiline: true,
                    hint:
                        'Mỗi dòng: 2026-12-01 19:00 → 2026-12-01 21:00. Tối đa 5 khoảng theo giờ thiết bị; chưa chốt lịch.',
                    rule: (v) => parsePreferredSlots(v) != null
                        ? null
                        : 'Nhập tối đa 5 khoảng tương lai, giờ kết thúc sau giờ bắt đầu, đúng mẫu hướng dẫn.',
                  ),
                ],
                submitLabel: 'Lưu bản nháp mẫu',
                onSubmit: (v) {
                  final key =
                      request?.id ??
                      'request-${DateTime.now().millisecondsSinceEpoch}';
                  notifier.save(
                    OwnRequest(
                      id: key,
                      title: v['title']!,
                      skill: v['skill']!,
                      skillId: previewSkillId(v['skill']!),
                      tags: v['tags']!
                          .split(',')
                          .map((tag) => tag.trim())
                          .where((tag) => tag.isNotEmpty)
                          .toList(),
                      preferredSlots: parsePreferredSlots(v['preferredSlots']!)!,
                      description: v['description']!,
                      goal: v['goal']!,
                      level: v['level']!,
                      status: 'DRAFT',
                    ),
                  );
                  context.pushReplacement('/requests/$key');
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
                      message: 'Lý do từ chối mẫu: ${request.reason}',
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
                  label: 'Đăng vào hàng chờ mẫu',
                  variant: ButtonVariant.craft,
                  onPressed: () =>
                      notifier.save(request.withStatus('PENDING_MODERATION')),
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
                      label: 'Xác nhận hủy bản mẫu',
                      onPressed: () {
                        notifier.save(request.withStatus('CANCELLED'));
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
