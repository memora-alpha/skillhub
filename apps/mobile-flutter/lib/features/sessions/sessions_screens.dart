import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../learning_paths/paths_data.dart';
import 'sessions_data.dart';

PreviewSession? _find(WidgetRef ref, String id) =>
    ref.watch(sessionsProvider).where((s) => s.id == id).firstOrNull;

/// Session list for one path, or the whole learning history when [id] is null.
class PathSessionsScreen extends ConsumerWidget {
  const PathSessionsScreen({super.key, this.id});

  final String? id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref
        .watch(sessionsProvider)
        .where((s) => id == null || s.pathId == id)
        .toList();
    return FeaturePage(
      title: id != null ? 'Buổi học của lộ trình' : 'Lịch sử học tập',
      back: id != null ? '/paths/$id' : '/calendar',
      children: [
        for (final s in items)
          Panel(
            title: s.title,
            children: [
              StatusBadge(s.status),
              Copy(
                '${s.partner} · ${viDateTime(s.startAt)} · ${s.duration} phút',
              ),
              RouteButton(
                href: '/learning-sessions/${s.id}',
                label: 'Chi tiết buổi học',
              ),
            ],
          ),
        if (items.isEmpty)
          const EmptyState(
            title: 'Chưa có buổi học',
            description:
                'Các buổi học xuất hiện sau khi tất cả lịch được xác nhận và khóa.',
          ),
      ],
    );
  }
}

class LearningSessionScreen extends ConsumerStatefulWidget {
  const LearningSessionScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<LearningSessionScreen> createState() =>
      _LearningSessionScreenState();
}

class _LearningSessionScreenState extends ConsumerState<LearningSessionScreen> {
  String? _error;

  @override
  Widget build(BuildContext context) {
    final id = widget.id;
    final s = _find(ref, id);
    final overrides = ref.read(sessionOverridesProvider.notifier);
    final change = s?.change;
    return FeaturePage(
      title: 'Chi tiết buổi học',
      back: s != null ? '/paths/${s.pathId}/sessions' : '/paths',
      children: s == null
          ? const [
              EmptyState(
                title: 'Không tìm thấy buổi học',
                description: 'Buổi học không có trong bản xem thử.',
              ),
            ]
          : [
              Panel(
                title: s.title,
                children: [
                  StatusBadge(s.status),
                  Copy('${s.partner} · Bạn ${s.mine ? 'dạy' : 'học'}'),
                  Copy('${viDateTime(s.startAt)} · ${s.duration} phút'),
                  Copy(
                    'Kế hoạch: ${s.planId}. Lộ trình: ${s.pathId}.',
                    muted: true,
                  ),
                  if (change != null)
                    FormNotice(
                      tone: NoticeTone.info,
                      message:
                          'Đề xuất đổi lịch v${change.version}: ${viDateTime(change.startAt)}. ${change.applied
                              ? 'Đã đủ hai bên xác nhận; lịch mới đã có hiệu lực.'
                              : change.meConfirmed
                              ? 'Chờ đối tác xác nhận; lịch cũ vẫn có hiệu lực.'
                              : 'Đối tác đã xác nhận. Chờ bạn xem và xác nhận trước hạn; lịch cũ vẫn có hiệu lực.'}',
                    ),
                ],
              ),
              if (_error != null)
                FormNotice(tone: NoticeTone.error, message: _error!),
              if (change != null && !change.applied && !change.meConfirmed)
                Panel(
                  title: 'Đề nghị đổi lịch v${change.version}',
                  children: [
                    Copy(change.reason),
                    AppButton(
                      label: 'Xác nhận đề nghị đổi lịch này',
                      onPressed: () =>
                          setState(() => _error = overrides.confirmChange(id)),
                    ),
                    AppButton(
                      label: 'Giữ lịch cũ',
                      variant: ButtonVariant.paper,
                      onPressed: () {
                        overrides.save(s.copyWith(change: null));
                        setState(() => _error = null);
                      },
                    ),
                  ],
                ),
              if (s.status == 'CONFIRMED') ...[
                RouteButton(
                  href: '/learning-sessions/$id/room',
                  label: 'Xem thử phòng học LiveKit',
                ),
                RouteButton(
                  secondary: true,
                  href: '/learning-sessions/$id/reschedule',
                  label: 'Đề nghị đổi lịch',
                ),
              ],
              if (const ['AWAITING_CONFIRMATION', 'COMPLETED'].contains(s.status))
                RouteButton(
                  href: '/learning-sessions/$id/completion',
                  label: 'Xác nhận & kết quả buổi học',
                ),
              RouteButton(
                secondary: true,
                href: Uri(
                  path: '/reports/new',
                  queryParameters: {'pathId': s.pathId, 'sessionId': s.id},
                ).toString(),
                label: 'Báo cáo vấn đề buổi học',
              ),
              RouteButton(
                secondary: true,
                href: '/paths/${s.pathId}',
                label: 'Xem tiến độ toàn lộ trình',
              ),
            ],
    );
  }
}

class RescheduleScreen extends ConsumerWidget {
  const RescheduleScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = _find(ref, id);
    return FeaturePage(
      title: 'Đề nghị đổi lịch',
      back: '/learning-sessions/$id',
      children: [
        if (s == null || s.status != 'CONFIRMED' || !canReschedule(s.startAt))
          const EmptyState(
            title: 'Không thể đổi lịch',
            description:
                'Hai bên phải xác nhận lịch mới ít nhất 60 phút trước giờ bắt đầu của lịch cũ.',
          )
        else
          Panel(
            title: 'Giữ lịch cũ đến khi chốt lịch mới',
            children: [
              Copy('Lịch hiện tại: ${viDateTime(s.startAt)}'),
              DataForm(
                fields: [
                  DataField(
                    name: 'start',
                    label: 'Ngày giờ mới (YYYY-MM-DDTHH:mm)',
                    rule: (v) =>
                        parseLocalDateTime(
                              v.trim(),
                            )?.isAfter(DateTime.now()) ??
                            false
                        ? null
                        : 'Nhập ngày giờ tương lai hợp lệ.',
                    hint: 'Sử dụng giờ địa phương trên thiết bị.',
                  ),
                  DataField(
                    name: 'duration',
                    label: 'Thời lượng (phút)',
                    rule: integerRule(60, 180),
                    numeric: true,
                  ),
                  DataField(
                    name: 'reason',
                    label: 'Lý do đổi lịch',
                    rule: textRule(10, 1000),
                    multiline: true,
                  ),
                ],
                defaults: {'duration': '${s.duration}'},
                submitLabel: 'Gửi đề nghị mẫu',
                onSubmit: (values) {
                  if (!canReschedule(s.startAt)) {
                    return 'Đã qua hạn chốt thay đổi lịch.';
                  }
                  final startAt = parseLocalDateTime(values['start']!)!;
                  final duration = int.parse(values['duration']!);
                  if (slotTaken(
                    ref.read(sessionsProvider),
                    id,
                    Slot(startAt: startAt, duration: duration),
                  )) {
                    return 'Thời gian mới trùng một buổi học khác.';
                  }
                  ref
                      .read(sessionOverridesProvider.notifier)
                      .save(
                        s.copyWith(
                          change: SessionChange(
                            startAt: startAt,
                            duration: duration,
                            reason: values['reason']!,
                            version: (s.change?.version ?? 0) + 1,
                            meConfirmed: true,
                            partnerConfirmed: false,
                            requestedBy: 'me',
                          ),
                        ),
                      );
                  context.pushReplacement('/learning-sessions/$id');
                  return null;
                },
              ),
            ],
          ),
      ],
    );
  }
}

class CompletionScreen extends ConsumerWidget {
  const CompletionScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = _find(ref, id);
    String confirmed(bool value) => value ? 'Đã xác nhận' : 'Chưa xác nhận';
    return FeaturePage(
      title: 'Xác nhận đã học',
      back: '/learning-sessions/$id',
      children: [
        if (s == null)
          const EmptyState(
            title: 'Không tìm thấy buổi học',
            description: 'Không thể xác nhận.',
          )
        else
          Panel(
            title: s.status == 'COMPLETED'
                ? 'Buổi học đã hoàn thành'
                : 'Cùng xác nhận sau buổi học',
            children: [
              Copy(s.title),
              Copy(
                'Bạn: ${confirmed(s.meConfirmed)} · Đối tác: ${confirmed(s.partnerConfirmed)}',
              ),
              AppButton(
                label: 'Tôi xác nhận đã học buổi này',
                disabled:
                    s.status != 'AWAITING_CONFIRMATION' ||
                    s.meConfirmed ||
                    DateTime.now().isBefore(s.endAt),
                onPressed: () =>
                    ref.read(sessionOverridesProvider.notifier).confirm(id),
              ),
              const Copy(
                'Chỉ đủ xác nhận của hai người sau giờ kết thúc mới hoàn thành buổi học. Credit tiếp tục được giữ đến cuối lộ trình.',
                muted: true,
              ),
              RouteButton(
                secondary: true,
                href: '/paths/${s.pathId}',
                label: 'Xem tiến độ lộ trình',
              ),
            ],
          ),
      ],
    );
  }
}

class RoomScreen extends ConsumerStatefulWidget {
  const RoomScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<RoomScreen> createState() => _RoomScreenState();
}

class _RoomScreenState extends ConsumerState<RoomScreen> {
  String _stage = 'waiting';
  bool _camera = false;
  bool _mic = false;
  bool _leave = false;

  @override
  Widget build(BuildContext context) {
    final id = widget.id;
    final s = _find(ref, id);
    return FeaturePage(
      title: 'Phòng học LiveKit',
      back: '/learning-sessions/$id',
      children: s == null || s.status != 'CONFIRMED'
          ? const [
              EmptyState(
                title: 'Phòng học không khả dụng',
                description:
                    'Buổi học đã kết thúc, đang có tranh chấp hoặc chưa đủ điều kiện vào phòng.',
              ),
            ]
          : [
              Panel(
                title: switch (_stage) {
                  'ended' => 'Bạn đã rời phòng mẫu',
                  'waiting' => 'Chuẩn bị buổi học',
                  _ => s.title,
                },
                accent: true,
                children: [
                  Copy(switch (_stage) {
                    'waiting' =>
                      'Kiểm tra thiết bị trước khi vào phòng. Giờ mở phòng thực tế do backend cấu hình.',
                    'ended' => 'Rời phòng không xác nhận hoàn thành buổi học.',
                    _ => 'Khung video mẫu · ${s.partner}',
                  }),
                  if (_stage != 'ended') ...[
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        AppButton(
                          label: _camera ? 'Tắt camera mẫu' : 'Bật camera mẫu',
                          variant: ButtonVariant.paper,
                          onPressed: () => setState(() => _camera = !_camera),
                        ),
                        AppButton(
                          label: _mic ? 'Tắt mic mẫu' : 'Bật mic mẫu',
                          variant: ButtonVariant.paper,
                          onPressed: () => setState(() => _mic = !_mic),
                        ),
                      ],
                    ),
                    const Copy(
                      'Không truy cập camera/microphone hoặc kết nối phòng thật trong bản xem thử.',
                      muted: true,
                    ),
                  ],
                  if (_stage == 'waiting')
                    AppButton(
                      label: 'Vào giao diện phòng mẫu',
                      onPressed: () => setState(() => _stage = 'room'),
                    ),
                  if (_stage == 'room')
                    AppButton(
                      label: 'Rời phòng',
                      variant: ButtonVariant.paper,
                      onPressed: () => setState(() => _leave = true),
                    ),
                ],
              ),
              if (_leave)
                Panel(
                  title: 'Rời buổi học?',
                  children: [
                    const Copy('Thao tác này chỉ đóng giao diện phòng mẫu.'),
                    AppButton(
                      label: 'Xác nhận rời phòng',
                      onPressed: () => setState(() {
                        _stage = 'ended';
                        _leave = false;
                      }),
                    ),
                    AppButton(
                      label: 'Ở lại',
                      variant: ButtonVariant.paper,
                      onPressed: () => setState(() => _leave = false),
                    ),
                  ],
                ),
              RouteButton(
                secondary: true,
                href: '/learning-sessions/$id',
                label: 'Chi tiết buổi học',
              ),
            ],
    );
  }
}
