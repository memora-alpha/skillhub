import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../core/theme/tokens.dart';
import '../skills/schema/skill_schema.dart';
import '../skills/skills_feature.dart';

/// RN `AgreementScheduleStep` direction chrome for the schedules overview.
class AgreementScheduleChrome extends ConsumerWidget {
  const AgreementScheduleChrome({
    super.key,
    required this.path,
    required this.me,
    required this.blocked,
  });

  final Map<String, dynamic> path;
  final String me;
  final bool blocked;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agreement = _map(path['agreement']);
    final plans = _list(path['plans']);
    final catalog = ref.watch(skillCatalogProvider).value ?? const <SkillRecord>[];
    final locked = path['lockedVersion'] != null;
    final stageFinalize = locked || path['status'] == 'SCHEDULED' || path['status'] == 'ACTIVE';
    final directions = _directions(path, me);
    final waitingPeer = directions.any(
      (item) => !item.mine && item.plan != null && item.plan!['schedule'] == null,
    );
    final conversationId = '${path['conversationId'] ?? ''}';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 12,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 10,
                children: [
                  Expanded(
                    child: Row(
                      spacing: 8,
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: AppColors.primarySoft,
                            borderRadius: BorderRadius.circular(AppRadii.button),
                          ),
                          child: const AppIcon(
                            AppIcon.calendar,
                            size: 20,
                            color: AppColors.primary,
                          ),
                        ),
                        Expanded(
                          child: Text(
                            stageFinalize ? 'Chốt lịch học' : 'Xác nhận lịch học',
                            style: nunito(
                              TypeScale.heading,
                              weight: FontWeight.w700,
                              color: AppColors.ink,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 9,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(AppRadii.badge),
                    ),
                    child: Text(
                      stageFinalize ? 'Chờ chốt' : 'Bước 3',
                      style: nunito(
                        TypeScale.secondary,
                        weight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
              Text(
                stageFinalize
                    ? 'Hai bên đã xác nhận lịch. Kiểm tra và chốt để bắt đầu học.'
                    : 'Hai bên xem và xác nhận cùng phiên bản lịch.',
                style: nunito(TypeScale.secondary, color: AppColors.body),
              ),
              if (agreement['exchangeType'] == 'TWO_WAY')
                Text(
                  'Trao đổi hai chiều · Bạn dạy và bạn học có lịch riêng.',
                  style: nunito(TypeScale.secondary, color: AppColors.muted),
                ),
              for (final direction in directions)
                _DirectionRow(
                  teaching: direction.mine,
                  plan: direction.plan,
                  skillName: direction.plan == null
                      ? null
                      : _skillName(
                          catalog,
                          '${direction.plan!['skillId'] ?? ''}',
                        ),
                  me: me,
                  path: path,
                ),
              if (waitingPeer && conversationId.isNotEmpty)
                AppButton(
                  label: 'Nhắc đối tác qua chat',
                  variant: ButtonVariant.paper,
                  disabled: blocked,
                  onPressed: () =>
                      context.go('/chat/$conversationId'),
                ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 8,
                children: [
                  const AppIcon(
                    AppIcon.shield,
                    size: 16,
                    color: AppColors.forest,
                  ),
                  Expanded(
                    child: Text(
                      'Hệ thống kiểm tra lịch và số dư trước khi chốt, tạm giữ Credit và tạo buổi học.',
                      style: nunito(
                        TypeScale.secondary,
                        color: AppColors.muted,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (plans.isEmpty)
          Text(
            'Hoàn thành lộ trình trước khi xếp lịch.',
            style: nunito(TypeScale.secondary, color: AppColors.muted),
          ),
      ],
    );
  }
}

class _DirectionRow extends StatelessWidget {
  const _DirectionRow({
    required this.teaching,
    required this.plan,
    required this.skillName,
    required this.me,
    required this.path,
  });

  final bool teaching;
  final Map<String, dynamic>? plan;
  final String? skillName;
  final String me;
  final Map<String, dynamic> path;

  @override
  Widget build(BuildContext context) {
    final schedule = plan == null ? null : _map(plan!['schedule']);
    final confirmed = schedule != null &&
        schedule['participantAConfirmedAt'] != null &&
        schedule['participantBConfirmedAt'] != null;
    final outlineCount = _list(plan?['sessionOutline']).length;
    final total = int.tryParse('${plan?['totalSessions']}') ?? outlineCount;
    final items = _list(schedule?['items']);
    final ready = schedule != null &&
        const {
          'PROPOSED',
          'PARTIALLY_CONFIRMED',
          'NEEDS_REVISION',
        }.contains(schedule['status']) &&
        plan != null &&
        items.length == total &&
        total > 0;
    final mine = schedule != null && _ownConfirmation(path, schedule, me);
    final done =
        schedule != null && (schedule['status'] == 'LOCKED' || (ready && confirmed));
    final label = _directionLabel(
      hasPlan: plan != null,
      hasSchedule: schedule != null,
      teaching: teaching,
      status: schedule?['status']?.toString(),
      ready: ready,
      confirmed: confirmed,
      mine: mine,
    );

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(AppRadii.control),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        spacing: 10,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 4,
              children: [
                Text(
                  teaching ? 'Lịch bạn dạy' : 'Lịch bạn học',
                  style: nunito(
                    TypeScale.body,
                    weight: FontWeight.w600,
                    color: AppColors.ink,
                  ),
                ),
                Text(
                  plan == null ? 'Chưa có lộ trình' : (skillName ?? 'Lộ trình học'),
                  style: nunito(
                    TypeScale.secondary,
                    weight: FontWeight.w500,
                    color: AppColors.body,
                  ),
                ),
                Text(
                  plan == null
                      ? 'Hoàn thành lộ trình trước khi xếp lịch'
                      : '$total buổi${schedule != null ? ' · Lịch bản ${schedule['version']}' : ''}',
                  style: nunito(TypeScale.secondary, color: AppColors.muted),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
            decoration: BoxDecoration(
              color: done ? AppColors.forestSoft : AppColors.amberSoft,
              borderRadius: BorderRadius.circular(AppRadii.badge),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              spacing: 4,
              children: [
                AppIcon(
                  done ? AppIcon.checkCircle : AppIcon.clock,
                  size: 14,
                  color: done ? AppColors.forest : AppColors.warning,
                ),
                Text(
                  label,
                  style: nunito(
                    TypeScale.secondary,
                    weight: FontWeight.w600,
                    color: done ? AppColors.forest : AppColors.warning,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

String _directionLabel({
  required bool hasPlan,
  required bool hasSchedule,
  required bool teaching,
  required String? status,
  required bool ready,
  required bool confirmed,
  required bool mine,
}) {
  if (!hasPlan) return 'Chờ lộ trình';
  if (!hasSchedule) {
    return teaching ? 'Bạn cần xếp lịch' : 'Chờ đối tác gửi lịch';
  }
  if (status == 'LOCKED') return 'Đã chốt';
  if (!ready && status != null) {
    return switch (status) {
      'DRAFT' => 'Bản nháp',
      'PROPOSED' => 'Đang thống nhất',
      'PARTIALLY_CONFIRMED' => 'Chờ đủ xác nhận',
      'NEEDS_REVISION' => 'Cần điều chỉnh',
      'CANCELLED' => 'Đã hủy',
      'EXPIRED' => 'Đã hết hạn',
      _ => status,
    };
  }
  if (confirmed) return 'Đã xác nhận';
  if (mine) return 'Chờ đối tác';
  return 'Bạn cần xác nhận';
}

List<({String key, Map<String, dynamic>? plan, bool mine})> _directions(
  Map<String, dynamic> path,
  String me,
) {
  final agreement = _map(path['agreement']);
  final plans = _list(path['plans']);
  if (agreement['exchangeType'] == 'TWO_WAY') {
    Map<String, dynamic>? teach;
    Map<String, dynamic>? learn;
    for (final plan in plans) {
      if ('${plan['teacherId']}' == me) teach = plan;
      if ('${plan['learnerId']}' == me) learn = plan;
    }
    return [
      (key: 'teach', plan: teach, mine: true),
      (key: 'learn', plan: learn, mine: false),
    ];
  }
  final plan = plans.isEmpty ? null : plans.first;
  final mine = plan != null && '${plan['teacherId']}' == me;
  return [(key: 'one', plan: plan, mine: mine)];
}

bool _ownConfirmation(
  Map<String, dynamic> path,
  Map<String, dynamic> schedule,
  String me,
) {
  if (me.isEmpty) return false;
  final field = path['participantAId'] == me
      ? 'participantAConfirmedAt'
      : 'participantBConfirmedAt';
  return schedule[field] != null;
}

String _skillName(List<SkillRecord> catalog, String id) {
  for (final skill in catalog) {
    if (skill.id == id) return skill.name;
  }
  return 'Lộ trình học';
}

Map<String, dynamic> _map(Object? value) {
  if (value is Map) return Map<String, dynamic>.from(value);
  return const {};
}

List<Map<String, dynamic>> _list(Object? value) {
  if (value is! List) return const [];
  return [
    for (final item in value)
      if (item is Map) Map<String, dynamic>.from(item),
  ];
}
