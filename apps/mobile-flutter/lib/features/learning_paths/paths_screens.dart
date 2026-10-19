import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../sessions/sessions_data.dart';
import 'paths_data.dart';

String _confirmed(bool value) => value ? 'Đã xác nhận' : 'Chưa xác nhận';

const _notFound = EmptyState(
  title: 'Không tìm thấy lộ trình',
  description: 'Lộ trình không có trong bản xem thử.',
);

class PathsScreen extends ConsumerStatefulWidget {
  const PathsScreen({super.key});

  @override
  ConsumerState<PathsScreen> createState() => _PathsScreenState();
}

class _PathsScreenState extends ConsumerState<PathsScreen> {
  String _filter = 'Tất cả';

  @override
  Widget build(BuildContext context) {
    final items = ref
        .watch(pathsProvider)
        .where((p) => _filter == 'Tất cả' || p.status == _filter)
        .toList();
    return FeaturePage(
      title: 'Lộ trình của tôi',
      back: '/calendar',
      subtitle: 'Mỗi lần học là một bước tiến cùng nhau.',
      children: [
        ChoiceGroup(
          label: 'Trạng thái',
          value: _filter,
          options: const [
            'Tất cả',
            'PROPOSED',
            'ACTIVE',
            'COMPLETED',
            'DISPUTED',
          ],
          onChange: (value) => setState(() => _filter = value),
        ),
        for (final path in items)
          Panel(
            title: path.title,
            children: [
              StatusBadge(path.status),
              Copy(
                '${path.partner} · ${path.type == 'TWO_WAY' ? 'Trao đổi hai chiều' : 'Dạy học một chiều'}',
              ),
              Copy(
                '${path.completedSessions}/${path.totalSessions} buổi · phiên bản ${path.version}',
                muted: true,
              ),
              RouteButton(href: '/paths/${path.id}', label: 'Mở lộ trình'),
            ],
          ),
        if (items.isEmpty)
          const EmptyState(
            title: 'Chưa có lộ trình',
            description:
                'Chấp nhận đề xuất và thương lượng qua tin nhắn để bắt đầu.',
          ),
        const RouteButton(
          secondary: true,
          href: '/messages',
          label: 'Đến cuộc trao đổi',
        ),
      ],
    );
  }
}

class AgreementTypeScreen extends ConsumerStatefulWidget {
  const AgreementTypeScreen({super.key, this.proposalId});

  final String? proposalId;

  @override
  ConsumerState<AgreementTypeScreen> createState() =>
      _AgreementTypeScreenState();
}

class _AgreementTypeScreenState extends ConsumerState<AgreementTypeScreen> {
  String _type = 'TWO_WAY';
  String _teacher = 'Tôi dạy';

  @override
  Widget build(BuildContext context) {
    final twoWay = _type == 'TWO_WAY';
    return FeaturePage(
      title: 'Chọn hình thức học',
      back: '/messages',
      children: [
        Panel(
          title: 'Cùng nhau thống nhất',
          children: [
            ChoiceGroup(
              label: 'Hình thức',
              value: _type,
              options: const ['TWO_WAY', 'ONE_WAY'],
              onChange: (value) => setState(() => _type = value),
            ),
            Copy(
              twoWay
                  ? 'Mỗi người tạo kế hoạch cho kỹ năng mình dạy. Hai kế hoạch có lịch và xác nhận riêng.'
                  : 'Một người dạy, một người học. Chỉ người học tạm giữ Credit.',
            ),
            if (!twoWay)
              ChoiceGroup(
                label: 'Vai trò đề xuất của tôi',
                value: _teacher,
                options: const ['Tôi dạy', 'Tôi học'],
                onChange: (value) => setState(() => _teacher = value),
              ),
            DataForm(
              key: ValueKey(_type),
              defaults: {'credit': twoWay ? '40' : '100'},
              fields: [
                DataField(
                  name: 'credit',
                  label: twoWay
                      ? 'Cam kết mỗi người / toàn thỏa thuận'
                      : 'Giá dạy toàn lộ trình (Credit)',
                  rule: creditRule(twoWay ? 20 : 0, twoWay),
                  numeric: true,
                ),
              ],
              submitLabel: 'Tạo thỏa thuận mẫu',
              onSubmit: (values) {
                final id = 'path-${DateTime.now().millisecondsSinceEpoch}';
                ref
                    .read(pathsProvider.notifier)
                    .save(
                      LearningPath(
                        id: id,
                        title: 'Thỏa thuận học mới',
                        partner: 'Đối tác trong cuộc trao đổi',
                        conversationId: widget.proposalId,
                        type: _type,
                        teacher: twoWay
                            ? null
                            : (_teacher == 'Tôi dạy' ? 'me' : 'partner'),
                        credit: values['credit']!,
                        version: 1,
                        status: 'PROPOSED',
                        plans: const [],
                        completedSessions: 0,
                      ),
                    );
                context.pushReplacement('/paths/$id');
                return null;
              },
            ),
          ],
        ),
        const Copy(
          'Đây là đề xuất ban đầu. Không tự tạo kế hoạch của đối tác, không khóa lịch và không tạm giữ Credit.',
          muted: true,
        ),
      ],
    );
  }
}

class PathDetailScreen extends ConsumerWidget {
  const PathDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(pathsProvider);
    final notifier = ref.read(pathsProvider.notifier);
    final path = notifier.find(id);
    final proposed = path?.status == 'PROPOSED';
    return FeaturePage(
      title: 'Không gian lộ trình',
      back: '/paths',
      children: path == null
          ? const [_notFound]
          : [
              Panel(
                title: path.title,
                accent: true,
                children: [
                  StatusBadge(path.status),
                  Copy('${path.partner} · ${path.type} · v${path.version}'),
                  MetricRow(
                    children: [
                      Metric(
                        label: path.type == 'TWO_WAY'
                            ? 'Cam kết mỗi người'
                            : 'Giá toàn lộ trình',
                        value: '${path.credit} CR',
                      ),
                      Metric(
                        label: 'Tiến độ buổi học',
                        value:
                            '${path.completedSessions}/${path.totalSessions}',
                      ),
                    ],
                  ),
                ],
              ),
              for (final plan in path.plans)
                Panel(
                  title: plan.skill,
                  children: [
                    Copy(
                      '${plan.teacher == 'me' ? 'Bạn dạy → đối tác học' : 'Đối tác dạy → bạn học'} · v${plan.version}',
                    ),
                    Copy(plan.goal),
                    StatusBadge(
                      plan.learnerVersion == plan.version
                          ? 'Người học đã xác nhận'
                          : 'Chờ người học xác nhận',
                    ),
                    RouteButton(
                      secondary: true,
                      href: '/paths/$id/plans/${plan.id}',
                      label: 'Xem kế hoạch',
                    ),
                  ],
                ),
              if (proposed &&
                  !path.plans.any((p) => p.teacher == 'me') &&
                  (path.type == 'TWO_WAY' || path.teacher == 'me'))
                RouteButton(
                  href: '/paths/$id/plans/new',
                  label: 'Tạo kế hoạch tôi dạy',
                ),
              if (path.plans.length < (path.type == 'TWO_WAY' ? 2 : 1))
                const FormNotice(
                  tone: NoticeTone.info,
                  message: 'Chờ đối tác tự tạo kế hoạch cho chiều họ dạy.',
                ),
              Panel(
                title: 'Xác nhận điều khoản chung',
                children: [
                  Copy(
                    'Bạn: ${_confirmed(path.meVersion == path.version)} · Đối tác: ${_confirmed(path.partnerVersion == path.version)}',
                  ),
                  const Copy(
                    'Xác nhận thỏa thuận không thay thế xác nhận riêng của từng kế hoạch.',
                    muted: true,
                  ),
                  if (proposed)
                    AppButton(
                      label: 'Xác nhận điều khoản v${path.version}',
                      variant: ButtonVariant.craft,
                      disabled:
                          !plansConfirmed(path) ||
                          path.meVersion == path.version,
                      onPressed: () =>
                          notifier.save(path.copyWith(meVersion: path.version)),
                    ),
                ],
              ),
              if (proposed) ...[
                RouteButton(
                  secondary: true,
                  href: '/paths/$id/schedules',
                  label: agreementConfirmed(path)
                      ? 'Lịch của từng kế hoạch'
                      : 'Xem điều kiện tạo lịch',
                ),
                RouteButton(
                  secondary: true,
                  href: '/paths/$id/hold',
                  label: 'Kiểm tra và tạm giữ Credit',
                ),
                RouteButton(
                  secondary: true,
                  href: '/paths/$id/terms',
                  label: 'Điều chỉnh điều khoản / hình thức',
                ),
              ],
              if (path.status == 'ACTIVE')
                RouteButton(
                  href: '/paths/$id/sessions',
                  label: 'Các buổi học',
                ),
              if (path.status == 'COMPLETED') ...[
                RouteButton(
                  href: '/paths/$id/settlement',
                  label: 'Kết quả quyết toán',
                ),
                RouteButton(
                  secondary: true,
                  href: '/paths/$id/review',
                  label: 'Đánh giá cuối lộ trình',
                ),
              ],
              if (path.status == 'DISPUTED')
                const FormNotice(
                  tone: NoticeTone.info,
                  message:
                      'Lộ trình đang có tranh chấp. Quyết toán cuối đang được giữ để xem xét.',
                ),
              if (const ['PROPOSED', 'ACTIVE', 'CANCELLED'].contains(path.status))
                RouteButton(
                  secondary: true,
                  href: '/paths/$id/cancel',
                  label: 'Hủy / dừng lộ trình',
                ),
              RouteButton(
                secondary: true,
                href: path.conversationId != null
                    ? '/chat/${path.conversationId}'
                    : '/messages',
                label: 'Trao đổi qua tin nhắn',
              ),
            ],
    );
  }
}

class PlanDetailScreen extends ConsumerWidget {
  const PlanDetailScreen({super.key, required this.id, required this.planId});

  final String id;
  final String planId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(pathsProvider);
    final notifier = ref.read(pathsProvider.notifier);
    final path = notifier.find(id);
    final plan = path?.plans.where((p) => p.id == planId).firstOrNull;
    return FeaturePage(
      title: 'Kế hoạch học tập',
      back: '/paths/$id',
      children: path == null || plan == null
          ? const [
              EmptyState(
                title: 'Không tìm thấy kế hoạch',
                description: 'Kiểm tra lại lộ trình đã chọn.',
              ),
            ]
          : [
              Panel(
                title: '${plan.skill} · v${plan.version}',
                children: [
                  Copy(
                    plan.teacher == 'me'
                        ? 'Bạn là người dạy'
                        : 'Bạn là người học',
                  ),
                  Copy(plan.goal),
                  for (final (i, lesson) in plan.outline.indexed)
                    Copy('Buổi ${i + 1}: $lesson'),
                  Copy(
                    plan.learnerVersion == plan.version
                        ? 'Người học đã xác nhận phiên bản hiện tại.'
                        : 'Đang chờ xác nhận phiên bản hiện tại.',
                    muted: true,
                  ),
                  if (plan.revision != null)
                    FormNotice(
                      tone: NoticeTone.info,
                      message: 'Yêu cầu chỉnh sửa: ${plan.revision}',
                    ),
                ],
              ),
              if (path.status == 'PROPOSED' && plan.teacher == 'me')
                RouteButton(
                  href: '/paths/$id/plans/$planId/edit',
                  label: 'Sửa kế hoạch tôi dạy',
                ),
              if (path.status == 'PROPOSED' && plan.teacher != 'me') ...[
                AppButton(
                  label: 'Xác nhận kế hoạch v${plan.version}',
                  variant: ButtonVariant.craft,
                  disabled: plan.learnerVersion == plan.version,
                  onPressed: () => notifier.save(
                    path.copyWith(
                      plans: [
                        for (final p in path.plans)
                          p.id == planId
                              ? p.copyWith(
                                  learnerVersion: p.version,
                                  revision: null,
                                )
                              : p,
                      ],
                    ),
                  ),
                ),
                Panel(
                  title: 'Đề nghị người dạy chỉnh sửa',
                  children: [
                    DataForm(
                      fields: [
                        DataField(
                          name: 'reason',
                          label: 'Nội dung muốn điều chỉnh',
                          rule: textRule(10, 1000),
                          multiline: true,
                        ),
                      ],
                      submitLabel: 'Gửi yêu cầu chỉnh sửa mẫu',
                      onSubmit: (values) {
                        notifier.save(
                          path.copyWith(
                            meVersion: null,
                            partnerVersion: null,
                            plans: [
                              for (final p in path.plans)
                                p.id == planId
                                    ? p.copyWith(
                                        learnerVersion: null,
                                        revision: values['reason'],
                                        schedule: null,
                                      )
                                    : p.copyWith(schedule: null),
                            ],
                          ),
                        );
                        return null;
                      },
                    ),
                  ],
                ),
              ],
              const Copy(
                'Chỉ người dạy tạo và sửa kế hoạch. Chỉnh sửa làm tăng phiên bản và cần người học xác nhận lại.',
                muted: true,
              ),
            ],
    );
  }
}

class PlanEditorScreen extends ConsumerWidget {
  const PlanEditorScreen({super.key, required this.id, this.planId});

  final String id;
  final String? planId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(pathsProvider);
    final notifier = ref.read(pathsProvider.notifier);
    final path = notifier.find(id);
    final plan = path?.plans.where((p) => p.id == planId).firstOrNull;
    final canEdit =
        path?.status == 'PROPOSED' &&
        (plan != null
            ? plan.teacher == 'me'
            : !path!.plans.any((p) => p.teacher == 'me') &&
                  (path.type == 'TWO_WAY' || path.teacher == 'me'));
    return FeaturePage(
      title: plan != null ? 'Sửa kế hoạch tôi dạy' : 'Tạo kế hoạch tôi dạy',
      back: '/paths/$id',
      children: path == null || !canEdit
          ? const [
              EmptyState(
                title: 'Không thể sửa kế hoạch này',
                description:
                    'Bạn chỉ tạo hoặc sửa kế hoạch mình dạy khi lộ trình còn thương lượng.',
              ),
            ]
          : [
              Panel(
                title: 'Thiết kế hành trình học',
                children: [
                  DataForm(
                    defaults: {
                      'skill': plan?.skill ?? 'React',
                      'goal': plan?.goal ?? '',
                      'count': '${plan?.outline.length ?? 2}',
                      'outline': plan?.outline.join('\n') ?? '',
                    },
                    fields: [
                      DataField(
                        name: 'skill',
                        label: 'Kỹ năng bạn dạy',
                        rule: textRule(1, 100),
                        choices: const [
                          'React',
                          'TypeScript',
                          'JavaScript',
                          'UI/UX',
                          'Tiếng Anh',
                          'Guitar',
                          'Nhiếp ảnh',
                        ],
                      ),
                      DataField(
                        name: 'goal',
                        label: 'Mục tiêu kế hoạch',
                        rule: textRule(10, 1500),
                        multiline: true,
                      ),
                      DataField(
                        name: 'count',
                        label: 'Số buổi',
                        rule: integerRule(1),
                        numeric: true,
                      ),
                      DataField(
                        name: 'outline',
                        label: 'Nội dung từng buổi',
                        rule: textRule(10, 3000),
                        multiline: true,
                        hint: 'Mỗi dòng là một buổi. Số dòng phải khớp số buổi.',
                      ),
                    ],
                    submitLabel: 'Gửi kế hoạch mẫu',
                    onSubmit: (values) {
                      final outline = values['outline']!
                          .split('\n')
                          .map((s) => s.trim())
                          .where((s) => s.isNotEmpty)
                          .toList();
                      if (outline.length != int.parse(values['count']!)) {
                        return 'Số dòng nội dung phải khớp số buổi.';
                      }
                      if (outline.any((s) => s.runes.length < 5)) {
                        return 'Mô tả rõ nội dung của từng buổi.';
                      }
                      final key =
                          plan?.id ??
                          'plan-${DateTime.now().millisecondsSinceEpoch}';
                      if (plan != null) {
                        final next = editOwnPlan(
                          path,
                          key,
                          skill: values['skill']!,
                          goal: values['goal']!,
                          outline: outline,
                        );
                        if (next != null) notifier.save(next);
                      } else {
                        notifier.save(
                          path.copyWith(
                            version: path.version + 1,
                            meVersion: null,
                            partnerVersion: null,
                            plans: [
                              for (final p in path.plans)
                                p.copyWith(schedule: null),
                              Plan(
                                id: key,
                                teacher: 'me',
                                learner: 'partner',
                                skill: values['skill']!,
                                goal: values['goal']!,
                                outline: outline,
                                version: 1,
                              ),
                            ],
                          ),
                        );
                      }
                      context.pushReplacement('/paths/$id/plans/$key');
                      return null;
                    },
                  ),
                  const Copy(
                    'Kế hoạch chỉ gửi cho chiều bạn dạy. Đối tác tự xác nhận bằng tài khoản của họ.',
                    muted: true,
                  ),
                ],
              ),
            ],
    );
  }
}

class SchedulesScreen extends ConsumerWidget {
  const SchedulesScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(pathsProvider);
    final notifier = ref.read(pathsProvider.notifier);
    final path = notifier.find(id);
    final enabled =
        path != null && agreementConfirmed(path) && path.status == 'PROPOSED';
    return FeaturePage(
      title: 'Lịch của từng kế hoạch',
      back: '/paths/$id',
      children: path == null
          ? const [_notFound]
          : [
              if (!enabled)
                const FormNotice(
                  tone: NoticeTone.info,
                  message:
                      'Chỉ tạo lịch sau khi đủ kế hoạch, người học xác nhận và hai bên xác nhận điều khoản chung cùng phiên bản.',
                ),
              for (final plan in path.plans)
                Panel(
                  title: plan.skill,
                  children: [
                    Copy(
                      '${plan.outline.length} buổi · lịch gắn kế hoạch ${plan.id}',
                    ),
                    if (plan.schedule case final schedule?) ...[
                      Copy('Phiên bản lịch ${schedule.version}'),
                      for (final (i, s) in schedule.slots.indexed)
                        Copy(
                          'Buổi ${i + 1}: ${viDateTime(s.startAt)} · ${s.duration} phút',
                        ),
                      Copy(
                        'Bạn: ${_confirmed(schedule.meVersion == schedule.version)} · Đối tác: ${_confirmed(schedule.partnerVersion == schedule.version)}',
                      ),
                      AppButton(
                        label: 'Xác nhận lịch v${schedule.version}',
                        disabled:
                            !enabled || schedule.meVersion == schedule.version,
                        onPressed: () => notifier.save(
                          path.copyWith(
                            plans: [
                              for (final p in path.plans)
                                p.id == plan.id && p.schedule != null
                                    ? p.copyWith(
                                        schedule: p.schedule!.copyWith(
                                          meVersion: p.schedule!.version,
                                        ),
                                      )
                                    : p,
                            ],
                          ),
                        ),
                      ),
                    ] else
                      const Copy('Chưa có đề xuất lịch.', muted: true),
                    if (enabled && plan.teacher == 'me')
                      RouteButton(
                        secondary: true,
                        href: '/paths/$id/schedules/${plan.id}',
                        label: plan.schedule != null
                            ? 'Sửa lịch tôi đề xuất'
                            : 'Đề xuất lịch tôi dạy',
                      ),
                    if (plan.schedule == null && plan.teacher != 'me')
                      const Copy(
                        'Chờ người dạy của kế hoạch này đề xuất lịch.',
                        muted: true,
                      ),
                  ],
                ),
              RouteButton(
                href: '/paths/$id/hold',
                label: 'Kiểm tra trước khi khóa lịch',
              ),
            ],
    );
  }
}

class ScheduleEditorScreen extends ConsumerWidget {
  const ScheduleEditorScreen({
    super.key,
    required this.id,
    required this.planId,
  });

  final String id;
  final String planId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(pathsProvider);
    final notifier = ref.read(pathsProvider.notifier);
    final path = notifier.find(id);
    final plan = path?.plans.where((p) => p.id == planId).firstOrNull;
    final enabled =
        path != null &&
        plan != null &&
        plan.teacher == 'me' &&
        agreementConfirmed(path) &&
        path.status == 'PROPOSED';
    if (!enabled) {
      return FeaturePage(
        title: 'Đề xuất lịch',
        back: '/paths/$id/schedules',
        children: const [
          EmptyState(
            title: 'Chưa thể tạo lịch',
            description:
                'Cần đủ xác nhận và bạn phải là người dạy của kế hoạch này.',
          ),
        ],
      );
    }
    final slots = plan.schedule?.slots ?? const <Slot>[];
    final timeZone = DateTime.now().timeZoneName;
    return FeaturePage(
      title: 'Đề xuất lịch',
      back: '/paths/$id/schedules',
      children: [
        Panel(
          title: plan.skill,
          children: [
            DataForm(
              defaults: {
                for (var i = 0; i < plan.outline.length; i++) ...{
                  'start$i': localDateInput(
                    i < slots.length ? slots[i].startAt : futureSlot(i + 1),
                  ),
                  'duration$i': '${i < slots.length ? slots[i].duration : 90}',
                },
              },
              fields: [
                for (final (i, lesson) in plan.outline.indexed) ...[
                  DataField(
                    name: 'start$i',
                    label: 'Buổi ${i + 1} · $lesson',
                    rule: (v) => parseLocalDateTime(v.trim()) == null
                        ? 'Nhập YYYY-MM-DDTHH:mm hợp lệ.'
                        : null,
                    hint:
                        'Giờ địa phương ($timeZone). Ví dụ 2026-10-20T19:00.',
                  ),
                  DataField(
                    name: 'duration$i',
                    label: 'Thời lượng (phút)',
                    rule: integerRule(60, 180),
                    numeric: true,
                  ),
                ],
              ],
              submitLabel: 'Gửi lịch mẫu mới',
              onSubmit: (values) {
                final next = [
                  for (var i = 0; i < plan.outline.length; i++)
                    Slot(
                      startAt: parseLocalDateTime(values['start$i']!)!,
                      duration: int.parse(values['duration$i']!),
                    ),
                ];
                final error = validSlots(next, plan.outline.length);
                if (error != null) return error;
                notifier.save(
                  path.copyWith(
                    plans: [
                      for (final p in path.plans)
                        p.id == planId
                            ? p.copyWith(
                                schedule: PlanSchedule(
                                  slots: next,
                                  version: (p.schedule?.version ?? 0) + 1,
                                ),
                              )
                            : p,
                    ],
                  ),
                );
                context.pushReplacement('/paths/$id/schedules');
                return null;
              },
            ),
          ],
        ),
      ],
    );
  }
}

class HoldScreen extends ConsumerStatefulWidget {
  const HoldScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<HoldScreen> createState() => _HoldScreenState();
}

class _HoldScreenState extends ConsumerState<HoldScreen> {
  bool _checked = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final id = widget.id;
    ref.watch(pathsProvider);
    final notifier = ref.read(pathsProvider.notifier);
    final path = notifier.find(id);
    final occupied = [
      for (final s in ref.watch(sessionsProvider))
        if (s.pathId != id && const ['CONFIRMED', 'DISPUTED'].contains(s.status))
          s.slot,
    ];
    String? validate() => finalValidation(
      path!,
      balances: (me: 180, partner: 180),
      occupied: occupied,
    );
    return FeaturePage(
      title: 'Kiểm tra & tạm giữ Credit',
      back: '/paths/$id',
      children: [
        if (path == null)
          const EmptyState(
            title: 'Không tìm thấy lộ trình',
            description: 'Không thể kiểm tra thỏa thuận.',
          )
        else if (path.status == 'ACTIVE')
          Panel(
            title: 'Lịch mẫu đã khóa',
            children: [
              const Copy(
                'Tất cả buổi học được gắn với kế hoạch tương ứng. Không có giao dịch thực được tạo.',
              ),
              RouteButton(
                href: '/paths/$id/sessions',
                label: 'Xem các buổi học',
              ),
            ],
          )
        else ...[
          Panel(
            title: 'Trước khi bắt đầu',
            children: [
              Copy(
                path.type == 'TWO_WAY'
                    ? 'Hai bên cùng tạm giữ ${path.credit} CR/người cho toàn thỏa thuận.'
                    : 'Chỉ người học tạm giữ ${path.credit} CR; người dạy tạm giữ 0 CR.',
              ),
              const Copy(
                'Số dư kiểm tra của hai tài khoản mẫu: 180 CR/người. Đây là kịch bản xem thử, không phải ví tài khoản của bạn.',
                muted: true,
              ),
              const Copy(
                'Kiểm tra đủ kế hoạch, các phiên bản xác nhận, thời lượng, trùng lịch và số dư trước khi khóa tất cả lịch cùng lúc.',
              ),
              AppButton(
                label: 'Kiểm tra điều kiện mẫu',
                variant: ButtonVariant.paper,
                onPressed: () => setState(() {
                  _error = validate();
                  _checked = true;
                }),
              ),
              if (_checked)
                FormNotice(
                  tone: _error != null ? NoticeTone.error : NoticeTone.success,
                  message: _error ?? 'Đủ điều kiện trong kịch bản mẫu.',
                ),
              AppButton(
                label: 'Xác nhận khóa lịch mẫu',
                variant: ButtonVariant.craft,
                disabled: !_checked || _error != null,
                onPressed: () {
                  final error = validate();
                  if (error != null) {
                    setState(() => _error = error);
                    return;
                  }
                  notifier.save(path.copyWith(status: 'ACTIVE'));
                },
              ),
            ],
          ),
          RouteButton(
            secondary: true,
            href: '/paths/$id/schedules',
            label: 'Quay lại kiểm tra lịch',
          ),
        ],
      ],
    );
  }
}

class PathCancellationScreen extends ConsumerStatefulWidget {
  const PathCancellationScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<PathCancellationScreen> createState() =>
      _PathCancellationScreenState();
}

class _PathCancellationScreenState
    extends ConsumerState<PathCancellationScreen> {
  ({String reason, DateTime at})? _draft;

  @override
  Widget build(BuildContext context) {
    final id = widget.id;
    ref.watch(pathsProvider);
    final notifier = ref.read(pathsProvider.notifier);
    final path = notifier.find(id);
    return FeaturePage(
      title: 'Hủy / dừng lộ trình',
      back: '/paths/$id',
      children: [
        if (path == null)
          const EmptyState(
            title: 'Không tìm thấy lộ trình',
            description: 'Chọn một lộ trình của bạn.',
          )
        else if (path.status == 'CANCELLED')
          Panel(
            title: 'Lộ trình mẫu đã hủy',
            children: [
              const Copy(
                'Hủy trước khi giữ Credit không tạo quyết toán hoàn thành.',
              ),
              if (path.cancellation case final cancellation?) ...[
                Copy('Người hủy: bạn · ${viDateTime(cancellation.at)}'),
                Copy('Lý do: ${cancellation.reason}'),
              ],
              const RouteButton(href: '/paths', label: 'Danh sách lộ trình'),
            ],
          )
        else if (!const ['PROPOSED', 'ACTIVE'].contains(path.status))
          const EmptyState(
            title: 'Không thể hủy ở trạng thái này',
            description: 'Theo dõi xử lý tranh chấp hoặc kết quả lộ trình.',
          )
        else ...[
          Panel(
            title: path.title,
            children: [
              Copy(
                path.status == 'PROPOSED'
                    ? 'Thỏa thuận chưa giữ Credit. Bạn có thể hủy bản xem thử trước khi bắt đầu.'
                    : 'Thỏa thuận đã giữ Credit. Phí hủy, số tiền hoàn trả và thời hạn cần chính sách được cấu hình.',
              ),
              const FormNotice(
                tone: NoticeTone.info,
                message:
                    'Không dùng mức quyết toán 96%/4% của lộ trình hoàn thành để tính tiền hủy. Bản xem thử không hoàn Credit hoặc trừ uy tín.',
              ),
              if (_draft case final draft?) ...[
                Copy('Người đề nghị: bạn · ${viDateTime(draft.at)}'),
                Copy('Lý do: ${draft.reason}'),
                const Copy(
                  'Nội dung chỉ được lưu tại màn hình xem thử này. Lộ trình và lịch học vẫn có hiệu lực; chưa gửi yêu cầu xử lý thật.',
                  muted: true,
                ),
              ] else
                DataForm(
                  fields: [
                    DataField(
                      name: 'reason',
                      label: 'Lý do hủy / dừng',
                      multiline: true,
                      rule: textRule(10, 1000),
                    ),
                  ],
                  submitLabel: path.status == 'PROPOSED'
                      ? 'Xác nhận hủy lộ trình mẫu'
                      : 'Xem thử nội dung đề nghị dừng',
                  onSubmit: (values) {
                    final now = DateTime.now();
                    if (path.status == 'PROPOSED') {
                      notifier.save(
                        path.copyWith(
                          status: 'CANCELLED',
                          cancellation: (
                            actor: 'me',
                            reason: values['reason']!,
                            at: now,
                          ),
                        ),
                      );
                    } else {
                      setState(
                        () => _draft = (reason: values['reason']!, at: now),
                      );
                    }
                    return null;
                  },
                ),
            ],
          ),
          if (path.status == 'ACTIVE') ...[
            RouteButton(
              secondary: true,
              href: '/paths/$id/sessions',
              label: 'Chọn buổi học để đổi lịch / báo cáo vắng mặt',
            ),
            const Copy(
              'No-show cần ghi nhận người liên quan, thời điểm và lý do trong báo cáo. Vi phạm và chế tài do hệ thống xác minh.',
              muted: true,
            ),
          ],
        ],
      ],
    );
  }
}

class SettlementScreen extends ConsumerWidget {
  const SettlementScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(pathsProvider);
    final path = ref.read(pathsProvider.notifier).find(id);
    return FeaturePage(
      title: 'Quyết toán cuối lộ trình',
      back: '/paths/$id',
      children: path == null || path.status != 'COMPLETED'
          ? const [
              EmptyState(
                title: 'Chưa có kết quả quyết toán',
                description:
                    'Cần tất cả buổi học hoàn thành và không còn tranh chấp giữ quyết toán.',
              ),
            ]
          : [
              Panel(
                title: 'Hành trình đã hoàn thành',
                accent: true,
                children: [
                  Copy(path.title),
                  Copy(
                    path.type == 'TWO_WAY'
                        ? 'Mỗi người nhận lại 96% khoản tạm giữ của chính mình. Phí nền tảng 4%.'
                        : 'Người dạy nhận 96% giá toàn lộ trình. Phí nền tảng 4%; người học không được hoàn lại giá dạy.',
                  ),
                  if (path.id == 'path-completed')
                    const Copy(
                      'Snapshot mẫu: người học trả 100 CR → người dạy nhận 96 CR · phí 4 CR.',
                    ),
                  if (path.id == 'path-completed-two-way')
                    const Copy(
                      'Snapshot mẫu: mỗi người giữ 40 CR → nhận lại 38.40 CR vào ví của chính mình · phí 1.60 CR/người.',
                    ),
                  const Copy(
                    'Kết quả số tiền và làm tròn thực tế phải lấy từ sổ cái backend. Hoàn thành từng buổi không tạo quyết toán riêng.',
                    muted: true,
                  ),
                ],
              ),
              RouteButton(href: '/paths/$id/review', label: 'Đánh giá đối tác'),
              const RouteButton(
                secondary: true,
                href: '/wallet/history',
                label: 'Xem giao dịch mẫu',
              ),
            ],
    );
  }
}

class TermsEditorScreen extends ConsumerStatefulWidget {
  const TermsEditorScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<TermsEditorScreen> createState() => _TermsEditorScreenState();
}

class _TermsEditorScreenState extends ConsumerState<TermsEditorScreen> {
  late final _initial = ref.read(pathsProvider.notifier).find(widget.id);
  late String _type = _initial?.type ?? 'TWO_WAY';
  late String _role = _initial?.teacher == 'partner' ? 'Tôi học' : 'Tôi dạy';

  @override
  Widget build(BuildContext context) {
    final id = widget.id;
    ref.watch(pathsProvider);
    final notifier = ref.read(pathsProvider.notifier);
    final path = notifier.find(id);
    final twoWay = _type == 'TWO_WAY';
    return FeaturePage(
      title: 'Điều chỉnh điều khoản',
      back: '/paths/$id',
      children: [
        if (path == null || path.status != 'PROPOSED')
          const EmptyState(
            title: 'Điều khoản đã khóa',
            description:
                'Sau khi chốt lịch, thay đổi điều khoản cần quy trình sửa đổi và đối soát tạm giữ riêng.',
          )
        else
          Panel(
            title: 'Thống nhất lại trước khi chốt',
            children: [
              ChoiceGroup(
                label: 'Hình thức',
                options: const ['TWO_WAY', 'ONE_WAY'],
                value: _type,
                onChange: (value) => setState(() => _type = value),
              ),
              if (!twoWay)
                ChoiceGroup(
                  label: 'Vai trò đề xuất',
                  options: const ['Tôi dạy', 'Tôi học'],
                  value: _role,
                  onChange: (value) => setState(() => _role = value),
                ),
              DataForm(
                key: ValueKey(_type),
                defaults: {'credit': path.credit},
                fields: [
                  DataField(
                    name: 'credit',
                    label: twoWay
                        ? 'Cam kết mỗi người (CR)'
                        : 'Giá dạy toàn lộ trình (CR)',
                    rule: creditRule(twoWay ? 20 : 0, twoWay),
                    numeric: true,
                  ),
                ],
                submitLabel: 'Gửi điều khoản mẫu mới',
                onSubmit: (values) {
                  final teacher = twoWay
                      ? null
                      : (_role == 'Tôi dạy' ? 'me' : 'partner');
                  final rolesChanged =
                      path.type != _type || path.teacher != teacher;
                  notifier.save(
                    path.copyWith(
                      type: _type,
                      teacher: teacher,
                      credit: values['credit'],
                      version: path.version + 1,
                      meVersion: null,
                      partnerVersion: null,
                      plans: rolesChanged
                          ? const []
                          : [
                              for (final p in path.plans)
                                p.copyWith(schedule: null),
                            ],
                    ),
                  );
                  context.pushReplacement('/paths/$id');
                  return null;
                },
              ),
              const Copy(
                'Điều khoản mới xóa xác nhận chung và lịch chưa khóa. Đổi hình thức hoặc vai trò yêu cầu hai bên tự tạo kế hoạch phù hợp lại.',
                muted: true,
              ),
            ],
          ),
      ],
    );
  }
}
