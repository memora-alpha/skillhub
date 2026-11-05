import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';
import '../../components/user_avatar.dart';
import '../../core/theme/tokens.dart';
import '../skills/schema/skill_schema.dart';
import '../skills/skills_feature.dart';
import 'agreement_schedule_chrome.dart';

enum AgreementStep { method, plans, schedules }

enum AgreementStage {
  terms,
  plans,
  schedules,
  finalize,
  sessions,
  closed,
}

class AgreementAction {
  const AgreementAction({required this.label, required this.href});

  final String label;
  final String href;
}

class AgreementProgress {
  const AgreementProgress({
    required this.stage,
    required this.title,
    required this.description,
    this.waiting = const [],
    this.action,
  });

  final AgreementStage stage;
  final String title;
  final String description;
  final List<String> waiting;
  final AgreementAction? action;
}

AgreementStep agreementStepFor(AgreementStage stage) {
  if (stage == AgreementStage.terms) return AgreementStep.method;
  if (stage == AgreementStage.plans) return AgreementStep.plans;
  return AgreementStep.schedules;
}

/// Display guidance from path snapshot — mirrors RN `agreementProgress`.
AgreementProgress agreementProgress(Map<String, dynamic> path, String me) {
  final id = '${path['id'] ?? ''}';
  final base = '/paths/$id';
  final agreement = _map(path['agreement']);
  final plans = _list(path['plans']);
  final participant =
      me.isNotEmpty &&
      (path['participantAId'] == me || path['participantBId'] == me);
  if (!participant) {
    return const AgreementProgress(
      stage: AgreementStage.closed,
      title: 'Không thể tiếp tục thỏa thuận',
      description:
          'Mở lộ trình bằng tài khoản tham gia cuộc trao đổi.',
    );
  }
  switch ('${path['status']}') {
    case 'CANCELLED':
      return const AgreementProgress(
        stage: AgreementStage.closed,
        title: 'Trạng thái thỏa thuận',
        description:
            'Thỏa thuận đã hủy. Không thể tiếp tục xác nhận kế hoạch hoặc lịch.',
      );
    case 'DISPUTED':
      return const AgreementProgress(
        stage: AgreementStage.closed,
        title: 'Trạng thái thỏa thuận',
        description:
            'Thỏa thuận đang có tranh chấp. Xem trạng thái và trao đổi với đối tác.',
      );
    case 'COMPLETED':
      return const AgreementProgress(
        stage: AgreementStage.closed,
        title: 'Trạng thái thỏa thuận',
        description:
            'Thỏa thuận đã hoàn thành. Bạn có thể xem lại các buổi học.',
      );
  }
  if (path['lockedVersion'] != null) {
    return AgreementProgress(
      stage: AgreementStage.sessions,
      title: 'Lịch đã chốt · Sẵn sàng học',
      description:
          'Hệ thống đã khóa lịch và tạo các buổi học. Xem lịch để chuẩn bị buổi tiếp theo.',
      action: AgreementAction(
        label: 'Xem các buổi học',
        href: '$base/sessions',
      ),
    );
  }
  if (!_editablePath(path)) {
    return const AgreementProgress(
      stage: AgreementStage.closed,
      title: 'Chưa thể tiếp tục',
      description: 'Tải lại trạng thái thỏa thuận trước khi thao tác.',
    );
  }
  if (!_agreementConfirmed(agreement)) {
    final mine = _ownConfirmation(path, agreement, me);
    return AgreementProgress(
      stage: AgreementStage.terms,
      title: 'Bước 1 · Thống nhất cách học',
      description:
          'Hai bên xác nhận hình thức, vai trò và Credit trước khi tạo lộ trình.',
      waiting: [
        mine
            ? 'Bạn đã xác nhận · Chờ đối tác đồng ý cách học.'
            : 'Bạn cần xem và đồng ý cách học của phiên bản hiện tại.',
      ],
      action: mine
          ? null
          : AgreementAction(label: 'Xem và đồng ý cách học', href: base),
    );
  }
  if (!_plansConfirmed(path, agreement, plans)) {
    return _plansProgress(path, agreement, plans, me, base);
  }
  if ('${path['status']}' != 'CONFIRMED') {
    return const AgreementProgress(
      stage: AgreementStage.plans,
      title: 'Bước 2 · Đang cập nhật thỏa thuận',
      description: 'Chờ trạng thái xác nhận từ hệ thống trước khi xếp lịch.',
      waiting: ['Đã đủ xác nhận · Đang chờ hệ thống cập nhật trạng thái.'],
    );
  }
  return _schedulesProgress(path, plans, me, base);
}

class AgreementContextBar extends StatelessWidget {
  const AgreementContextBar({
    super.key,
    required this.name,
    required this.pathId,
    required this.partnerId,
  });

  final String name;
  final String pathId;
  final String partnerId;

  @override
  Widget build(BuildContext context) {
    final code = pathId.length >= 8
        ? pathId.substring(pathId.length - 8).toUpperCase()
        : pathId.toUpperCase();
    return Row(
      spacing: 10,
      children: [
        Expanded(
          child: Row(
            spacing: 10,
            children: [
              if (partnerId.isNotEmpty)
                UserAvatar(
                  name: name,
                  userId: partnerId,
                  size: AvatarSizes.list,
                ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 2,
                  children: [
                    Text(
                      partnerId.isEmpty ? 'Cùng' : 'Cùng đối tác',
                      style: nunito(
                        TypeScale.caption,
                        color: AppColors.muted,
                      ),
                    ),
                    Text(
                      name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: nunito(
                        TypeScale.body,
                        weight: FontWeight.w600,
                        color: AppColors.ink,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
          decoration: BoxDecoration(
            color: AppColors.surfaceLow,
            borderRadius: BorderRadius.circular(AppRadii.badge),
          ),
          child: Text(
            '#$code',
            style: nunito(
              TypeScale.caption,
              weight: FontWeight.w500,
              color: AppColors.muted,
            ),
          ),
        ),
      ],
    );
  }
}

class AgreementStepsBar extends StatelessWidget {
  const AgreementStepsBar({
    super.key,
    required this.value,
    required this.current,
    required this.onSelect,
  });

  final AgreementStep value;
  final AgreementStep current;
  final ValueChanged<AgreementStep> onSelect;

  static const _order = [
    AgreementStep.method,
    AgreementStep.plans,
    AgreementStep.schedules,
  ];
  static const _labels = ['Cách học', 'Lộ trình', 'Lịch học'];

  @override
  Widget build(BuildContext context) {
    final currentIndex = _order.indexOf(current);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Stack(
        children: [
          Positioned(
            top: 15,
            left: 0,
            right: 0,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Row(
                children: [
                  for (var i = 0; i < 2; i++)
                    Expanded(
                      child: Container(
                        height: 2,
                        color: i < currentIndex
                            ? AppColors.primary
                            : AppColors.surfaceInset,
                      ),
                    ),
                ],
              ),
            ),
          ),
          Row(
            children: [
              for (var i = 0; i < _order.length; i++)
                Expanded(
                  child: _StepCell(
                    index: i,
                    label: _labels[i],
                    selected: value == _order[i],
                    done: i < currentIndex,
                    disabled: i > currentIndex,
                    onTap: () => onSelect(_order[i]),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StepCell extends StatelessWidget {
  const _StepCell({
    required this.index,
    required this.label,
    required this.selected,
    required this.done,
    required this.disabled,
    required this.onTap,
  });

  final int index;
  final String label;
  final bool selected;
  final bool done;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final caption = done
        ? 'Đã thống nhất'
        : (selected ? 'Đang thống nhất' : 'Chưa bắt đầu');
    return Opacity(
      opacity: disabled ? 0.5 : 1,
      child: InkWell(
        onTap: disabled ? null : onTap,
        borderRadius: BorderRadius.circular(AppRadii.control),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
          child: Column(
            spacing: 4,
            children: [
              Container(
                width: 30,
                height: 30,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: selected
                      ? AppColors.primary
                      : (done ? AppColors.forestSoft : AppColors.surfaceLow),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected
                        ? AppColors.primaryMuted
                        : AppColors.surface,
                    width: 2,
                  ),
                ),
                child: done && !selected
                    ? const AppIcon(
                        AppIcon.check,
                        size: 16,
                        color: AppColors.forest,
                      )
                    : Text(
                        '${index + 1}',
                        style: nunito(
                          TypeScale.body,
                          weight: FontWeight.w700,
                          color: selected
                              ? AppColors.white
                              : (done ? AppColors.forest : AppColors.muted),
                        ),
                      ),
              ),
              Text(
                label,
                textAlign: TextAlign.center,
                style: nunito(
                  TypeScale.secondary,
                  weight: FontWeight.w600,
                  color: selected ? AppColors.primary : AppColors.body,
                ),
              ),
              Text(
                caption,
                textAlign: TextAlign.center,
                style: nunito(
                  TypeScale.caption,
                  color: selected ? AppColors.primary : AppColors.muted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AgreementFooter extends StatelessWidget {
  const AgreementFooter({
    super.key,
    required this.conversationId,
    this.primary,
    this.reviewLabel,
    this.onReview,
    this.reviewDisabled = false,
  });

  final String conversationId;
  final Widget? primary;
  final String? reviewLabel;
  final VoidCallback? onReview;
  final bool reviewDisabled;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        ?primary,
        AppButton(
          variant: ButtonVariant.white,
          minHeight: 48,
          borderRadius: AppRadii.card,
          border: Border.all(color: AppColors.border),
          semanticLabel: 'Trao đổi qua chat',
          onPressed: () => context.go(
            conversationId.isEmpty ? '/messages' : '/chat/$conversationId',
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            spacing: 8,
            children: [
              const AppIcon(
                AppIcon.message,
                size: 18,
                color: AppColors.muted,
              ),
              Text(
                'Trao đổi qua chat',
                style: nunito(
                  TypeScale.body,
                  weight: FontWeight.w600,
                  color: AppColors.body,
                ),
              ),
            ],
          ),
        ),
        if (reviewLabel != null && onReview != null)
          AppButton(
            label: reviewLabel,
            variant: ButtonVariant.ghost,
            size: ButtonSize.sm,
            disabled: reviewDisabled,
            onPressed: onReview,
          ),
      ],
    );
  }
}

class AgreementSessionsReadyPanel extends StatelessWidget {
  const AgreementSessionsReadyPanel({
    super.key,
    required this.pathId,
    required this.actionLabel,
  });

  final String pathId;
  final String actionLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.forestSoft,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.forestMuted),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          Text(
            'Lịch đã chốt · Sẵn sàng học',
            style: nunito(
              TypeScale.heading,
              weight: FontWeight.w700,
              color: AppColors.ink,
            ),
          ),
          Text(
            'Hệ thống đã khóa lịch và tạo các buổi học. Xem lịch để chuẩn bị buổi tiếp theo.',
            style: nunito(TypeScale.secondary, color: AppColors.body),
          ),
          AppButton(
            label: actionLabel,
            variant: ButtonVariant.craft,
            minHeight: 50,
            borderRadius: AppRadii.card,
            onPressed: () => context.go('/paths/$pathId/sessions'),
          ),
        ],
      ),
    );
  }
}

class AgreementMethodStepPanel extends ConsumerWidget {
  const AgreementMethodStepPanel({
    super.key,
    required this.path,
    required this.me,
    required this.partnerId,
    required this.partnerName,
    required this.blocked,
    required this.busy,
    required this.error,
    required this.onConfirm,
    required this.onContinue,
  });

  final Map<String, dynamic> path;
  final String me;
  final String partnerId;
  final String partnerName;
  final bool blocked;
  final bool busy;
  final String? error;
  final VoidCallback onConfirm;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agreement = _map(path['agreement']);
    final twoWay = agreement['exchangeType'] == 'TWO_WAY';
    final mine = _ownConfirmation(path, agreement, me);
    final otherField = path['participantAId'] == partnerId
        ? 'participantAConfirmedAt'
        : 'participantBConfirmedAt';
    final other = agreement[otherField] != null;
    final both = mine && other;
    final editable = _editablePath(path);
    final credit = twoWay
        ? '${agreement['totalCreditPerUser'] ?? ''}'
        : '${agreement['negotiatedCredit'] ?? ''}';
    final assignment = agreement['teacherId'] == me
        ? 'Bạn dạy · Đối tác học'
        : 'Đối tác dạy · Bạn học';
    final conversationId = '${path['conversationId'] ?? ''}';
    final count = (mine ? 1 : 0) + (other ? 1 : 0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 14,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Thống nhất cách học',
                      style: nunito(
                        TypeScale.heading,
                        weight: FontWeight.w700,
                        color: AppColors.ink,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(AppRadii.badge),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      spacing: 4,
                      children: [
                        const AppIcon(
                          AppIcon.users,
                          size: 14,
                          color: AppColors.primary,
                        ),
                        Text(
                          twoWay ? 'Trao đổi hai chiều' : 'Học một chiều',
                          style: nunito(
                            TypeScale.caption,
                            weight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 10,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(AppRadii.button),
                    ),
                    child: const AppIcon(
                      AppIcon.clipboard,
                      size: 18,
                      color: AppColors.primary,
                    ),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      spacing: 4,
                      children: [
                        Text(
                          'Phân công lộ trình',
                          style: nunito(
                            TypeScale.body,
                            weight: FontWeight.w600,
                            color: AppColors.ink,
                          ),
                        ),
                        Text(
                          twoWay
                              ? 'Mỗi người tạo lộ trình mình dạy, xác nhận lộ trình mình học trước khi xếp lịch.'
                              : '$assignment. Người học xác nhận lộ trình trước khi xếp lịch.',
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
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.amberSoft,
                  borderRadius: BorderRadius.circular(AppRadii.control),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: 8,
                  children: [
                    Text(
                      twoWay ? 'CREDIT CAM KẾT' : 'CREDIT TOÀN LỘ TRÌNH',
                      style: nunito(
                        TypeScale.caption,
                        weight: FontWeight.w700,
                        color: AppColors.muted,
                      ),
                    ),
                    Text.rich(
                      TextSpan(
                        text: credit.isEmpty ? '—' : credit,
                        style: nunito(
                          TypeScale.title,
                          weight: FontWeight.w700,
                          color: AppColors.ink,
                        ),
                        children: [
                          TextSpan(
                            text: twoWay ? ' Credit / người' : ' Credit',
                            style: nunito(
                              TypeScale.secondary,
                              color: AppColors.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Row(
                      spacing: 6,
                      children: [
                        const AppIcon(
                          AppIcon.lock,
                          size: 14,
                          color: AppColors.forest,
                        ),
                        Expanded(
                          child: Text(
                            twoWay
                                ? 'Credit chỉ tạm giữ khi chốt lịch.'
                                : 'Chỉ người học tạm giữ khi chốt lịch.',
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
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'TRẠNG THÁI XÁC NHẬN',
                      style: nunito(
                        TypeScale.caption,
                        weight: FontWeight.w700,
                        color: AppColors.muted,
                      ),
                    ),
                  ),
                  Text(
                    '$count/2 đã đồng ý',
                    style: nunito(
                      TypeScale.secondary,
                      weight: FontWeight.w600,
                      color: count == 2 ? AppColors.forest : AppColors.body,
                    ),
                  ),
                ],
              ),
              _ConfirmPerson(name: 'Bạn', userId: me, confirmed: mine),
              _ConfirmPerson(
                name: partnerName,
                userId: partnerId,
                confirmed: other,
              ),
              if (error != null) FormNotice(tone: NoticeTone.error, message: error!),
            ],
          ),
        ),
        AgreementFooter(
          conversationId: conversationId,
          reviewLabel: editable ? 'Chỉnh sửa cách học' : null,
          onReview: editable
              ? () => context.go('/paths/${path['id']}/terms')
              : null,
          reviewDisabled: blocked || busy,
          primary: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 8,
            children: [
              if (editable && !mine)
                AppButton(
                  label: busy ? 'Đang xác nhận…' : 'Đồng ý cách học',
                  variant: ButtonVariant.craft,
                  minHeight: 50,
                  borderRadius: AppRadii.card,
                  loading: busy,
                  disabled: blocked || busy,
                  onPressed: onConfirm,
                ),
              if (editable && mine && !both)
                const Copy(
                  'Đã xác nhận · Chờ đối tác đồng ý cách học.',
                  muted: true,
                ),
              if (both)
                AppButton(
                  label: 'Tiếp tục: Lộ trình',
                  minHeight: 50,
                  borderRadius: AppRadii.card,
                  disabled: blocked,
                  onPressed: onContinue,
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ConfirmPerson extends StatelessWidget {
  const _ConfirmPerson({
    required this.name,
    required this.userId,
    required this.confirmed,
  });

  final String name;
  final String userId;
  final bool confirmed;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(AppRadii.control),
      ),
      child: Row(
        spacing: 10,
        children: [
          UserAvatar(name: name, userId: userId, size: AvatarSizes.list),
          Expanded(
            child: Text(
              name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: nunito(
                TypeScale.body,
                weight: FontWeight.w600,
                color: AppColors.ink,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
            decoration: BoxDecoration(
              color: confirmed ? AppColors.forestSoft : AppColors.amberSoft,
              borderRadius: BorderRadius.circular(AppRadii.badge),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              spacing: 4,
              children: [
                AppIcon(
                  confirmed ? AppIcon.checkCircle : AppIcon.clock,
                  size: 12,
                  color: confirmed ? AppColors.forest : AppColors.warning,
                ),
                Text(
                  confirmed ? 'Đã xác nhận' : 'Chưa xác nhận',
                  style: nunito(
                    TypeScale.caption,
                    weight: FontWeight.w600,
                    color: confirmed ? AppColors.forest : AppColors.warning,
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

class AgreementPlansStepPanel extends ConsumerWidget {
  const AgreementPlansStepPanel({
    super.key,
    required this.path,
    required this.me,
    required this.partnerName,
    required this.blocked,
    required this.canContinue,
    required this.onReviewMethod,
    required this.onContinue,
  });

  final Map<String, dynamic> path;
  final String me;
  final String partnerName;
  final bool blocked;
  final bool canContinue;
  final VoidCallback onReviewMethod;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agreement = _map(path['agreement']);
    final plans = _list(path['plans']);
    final twoWay = agreement['exchangeType'] == 'TWO_WAY';
    final partnerId = path['participantAId'] == me
        ? '${path['participantBId'] ?? ''}'
        : '${path['participantAId'] ?? ''}';
    final teachers = twoWay
        ? [partnerId, me]
        : ['${agreement['teacherId'] ?? ''}'];
    final catalog = ref.watch(skillCatalogProvider).value ?? const <SkillRecord>[];
    final conversationId = '${path['conversationId'] ?? ''}';
    final editable = _editablePath(path);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.primarySoft,
            borderRadius: BorderRadius.circular(AppRadii.card),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 10,
            children: [
              const AppIcon(AppIcon.users, size: 22, color: AppColors.primary),
              Expanded(
                child: Text(
                  twoWay
                      ? 'Mỗi người tạo lộ trình mình dạy; có thể cùng chuẩn bị.'
                      : 'Người dạy tạo lộ trình, người học xác nhận trước khi xếp lịch.',
                  style: nunito(TypeScale.secondary, color: AppColors.body),
                ),
              ),
            ],
          ),
        ),
        for (final teacherId in teachers.where((id) => id.isNotEmpty))
          _PlanDirectionCard(
            path: path,
            plan: _planByTeacher(plans, teacherId),
            mine: teacherId == me,
            partnerName: partnerName,
            catalog: catalog,
            canCreate:
                editable &&
                teacherId == me &&
                !plans.any((plan) => '${plan['teacherId']}' == me) &&
                (twoWay || agreement['teacherId'] == me),
            canEdit:
                editable &&
                teacherId == me &&
                plans.any(
                  (plan) =>
                      '${plan['teacherId']}' == me &&
                      plan['learnerConfirmedAt'] == null,
                ),
            blocked: blocked,
          ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 8,
          children: [
            const AppIcon(AppIcon.shield, size: 16, color: AppColors.muted),
            Expanded(
              child: Text(
                'Lộ trình cần người học xác nhận. Credit chỉ tạm giữ khi hai bên chốt lịch.',
                style: nunito(TypeScale.secondary, color: AppColors.muted),
              ),
            ),
          ],
        ),
        AgreementFooter(
          conversationId: conversationId,
          reviewLabel: 'Xem lại cách học',
          onReview: onReviewMethod,
          primary: canContinue
              ? AppButton(
                  label: 'Tiếp tục: Lịch học',
                  minHeight: 50,
                  borderRadius: AppRadii.card,
                  disabled: blocked,
                  onPressed: onContinue,
                )
              : null,
        ),
      ],
    );
  }
}

class _PlanDirectionCard extends StatelessWidget {
  const _PlanDirectionCard({
    required this.path,
    required this.plan,
    required this.mine,
    required this.partnerName,
    required this.catalog,
    required this.canCreate,
    required this.canEdit,
    required this.blocked,
  });

  final Map<String, dynamic> path;
  final Map<String, dynamic>? plan;
  final bool mine;
  final String partnerName;
  final List<SkillRecord> catalog;
  final bool canCreate;
  final bool canEdit;
  final bool blocked;

  @override
  Widget build(BuildContext context) {
    final confirmed = plan?['learnerConfirmedAt'] != null;
    final needsAction = canCreate || (plan != null && !mine && !confirmed);
    final status = _planDirectionLabel(
      plan: plan,
      mine: mine,
      canCreate: canCreate,
      confirmed: confirmed,
    );
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 10,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 8,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 2,
                  children: [
                    Text(
                      mine ? 'Bạn dạy' : 'Bạn học',
                      style: nunito(
                        TypeScale.body,
                        weight: FontWeight.w700,
                        color: mine ? AppColors.primary : AppColors.forest,
                      ),
                    ),
                    Text(
                      '${mine ? 'Học viên' : 'Người dạy'}: $partnerName',
                      style: nunito(
                        TypeScale.secondary,
                        color: AppColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                decoration: BoxDecoration(
                  color: confirmed
                      ? AppColors.forestSoft
                      : (needsAction
                            ? AppColors.amberSoft
                            : AppColors.surfaceLow),
                  borderRadius: BorderRadius.circular(AppRadii.badge),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  spacing: 4,
                  children: [
                    AppIcon(
                      confirmed ? AppIcon.checkCircle : AppIcon.clock,
                      size: 12,
                      color: confirmed ? AppColors.forest : AppColors.warning,
                    ),
                    Text(
                      status,
                      style: nunito(
                        TypeScale.caption,
                        weight: FontWeight.w600,
                        color: confirmed
                            ? AppColors.forest
                            : AppColors.warning,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (plan == null) ...[
            Text(
              mine ? 'Thiết kế lộ trình bạn dạy' : 'Chờ đối tác lên lộ trình',
              style: nunito(
                TypeScale.body,
                weight: FontWeight.w600,
                color: AppColors.ink,
              ),
            ),
            Text(
              mine
                  ? 'Thêm mục tiêu và nội dung cho từng buổi học.'
                  : '$partnerName sẽ chuẩn bị nội dung cho chiều bạn học.',
              style: nunito(TypeScale.secondary, color: AppColors.muted),
            ),
            if (canCreate)
              AppButton(
                label: 'Tạo lộ trình bạn dạy',
                size: ButtonSize.sm,
                disabled: blocked,
                onPressed: () =>
                    context.go('/paths/${path['id']}/plans/new'),
              ),
          ] else ...[
            Text(
              '${plan!['learningGoal'] ?? ''}',
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: nunito(TypeScale.body, color: AppColors.body),
            ),
            Row(
              spacing: 8,
              children: [
                Text(
                  _skillName(catalog, '${plan!['skillId'] ?? ''}'),
                  style: nunito(
                    TypeScale.secondary,
                    weight: FontWeight.w600,
                    color: mine ? AppColors.primary : AppColors.forest,
                  ),
                ),
                const AppIcon(
                  AppIcon.calendar,
                  size: 12,
                  color: AppColors.muted,
                ),
                Text(
                  '${plan!['totalSessions'] ?? 0} buổi',
                  style: nunito(TypeScale.secondary, color: AppColors.muted),
                ),
                Text(
                  '· Bản ${plan!['version'] ?? ''}',
                  style: nunito(TypeScale.secondary, color: AppColors.muted),
                ),
              ],
            ),
            if (confirmed)
              Row(
                spacing: 6,
                children: [
                  const AppIcon(
                    AppIcon.checkCircle,
                    size: 14,
                    color: AppColors.forest,
                  ),
                  Text(
                    'Người học đã xác nhận',
                    style: nunito(
                      TypeScale.secondary,
                      weight: FontWeight.w600,
                      color: AppColors.forest,
                    ),
                  ),
                ],
              ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                AppButton(
                  label: !mine && !confirmed
                      ? 'Xem và xác nhận lộ trình'
                      : 'Xem chi tiết',
                  size: ButtonSize.sm,
                  variant: !mine && !confirmed
                      ? ButtonVariant.craft
                      : ButtonVariant.secondary,
                  onPressed: () => context.go(
                    '/paths/${path['id']}/plans/${plan!['id']}',
                  ),
                ),
                if (canEdit)
                  AppButton(
                    label: 'Chỉnh sửa',
                    size: ButtonSize.sm,
                    variant: ButtonVariant.paper,
                    disabled: blocked,
                    onPressed: () => context.go(
                      '/paths/${path['id']}/plans/${plan!['id']}/edit',
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class AgreementScheduleStepPanel extends StatelessWidget {
  const AgreementScheduleStepPanel({
    super.key,
    required this.path,
    required this.me,
    required this.blocked,
    required this.progress,
    required this.onReviewPlans,
  });

  final Map<String, dynamic> path;
  final String me;
  final bool blocked;
  final AgreementProgress progress;
  final VoidCallback onReviewPlans;

  @override
  Widget build(BuildContext context) {
    final conversationId = '${path['conversationId'] ?? ''}';
    final action = progress.action ??
        AgreementAction(
          label: 'Xem trạng thái lịch',
          href: '/paths/${path['id']}/schedules',
        );
    if (progress.stage != AgreementStage.schedules &&
        progress.stage != AgreementStage.finalize) {
      return Panel(
        title: progress.title.replaceFirst(RegExp(r'^Bước \d+ · '), ''),
        accent: true,
        children: [
          for (final message in progress.waiting) Copy(message),
          if (!blocked && progress.action != null)
            AppButton(
              label: progress.action!.label,
              onPressed: () => context.go(progress.action!.href),
            ),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        AgreementScheduleChrome(path: path, me: me, blocked: blocked),
        if (progress.waiting.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(AppRadii.control),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 8,
              children: [
                const AppIcon(
                  AppIcon.clock,
                  size: 18,
                  color: AppColors.primary,
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 4,
                    children: [
                      for (final message in progress.waiting)
                        Text(
                          message,
                          style: nunito(
                            TypeScale.secondary,
                            color: AppColors.body,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        AgreementFooter(
          conversationId: conversationId,
          reviewLabel: 'Xem lại lộ trình',
          onReview: onReviewPlans,
          primary: AppButton(
            label: action.label,
            minHeight: 50,
            borderRadius: AppRadii.card,
            disabled: blocked,
            onPressed: () => context.go(action.href),
          ),
        ),
      ],
    );
  }
}

String _planDirectionLabel({
  required Map<String, dynamic>? plan,
  required bool mine,
  required bool canCreate,
  required bool confirmed,
}) {
  if (plan != null && confirmed) return 'Đã xác nhận';
  if (plan != null && mine) return 'Chờ người học';
  if (plan != null) return 'Bạn cần xác nhận';
  if (mine && canCreate) return 'Phần việc của bạn';
  if (mine) return 'Chưa có lộ trình';
  return 'Chờ đối tác tạo';
}

AgreementProgress _plansProgress(
  Map<String, dynamic> path,
  Map<String, dynamic> agreement,
  List<Map<String, dynamic>> plans,
  String me,
  String base,
) {
  final waiting = <String>[];
  AgreementAction? action;
  for (final pair in _planDirections(path, agreement)) {
    final teacher = pair.$1;
    final learner = pair.$2;
    final plan = _planByPair(plans, teacher, learner);
    if (plan != null &&
        plan['status'] == 'CONFIRMED' &&
        plan['learnerConfirmedAt'] != null) {
      continue;
    }
    if (plan == null) {
      final mine = teacher == me;
      waiting.add(
        mine
            ? 'Bạn cần tạo kế hoạch mình dạy.'
            : 'Chờ đối tác tạo kế hoạch họ dạy.',
      );
      action ??= mine
          ? AgreementAction(
              label: 'Tạo kế hoạch tôi dạy',
              href: '$base/plans/new',
            )
          : null;
      continue;
    }
    final mine = learner == me;
    waiting.add(
      mine
          ? 'Bạn cần xem và xác nhận kế hoạch mình học.'
          : 'Chờ đối tác xác nhận kế hoạch bạn dạy.',
    );
    action ??= mine
        ? AgreementAction(
            label: 'Xem kế hoạch để xác nhận',
            href: '$base/plans/${plan['id']}',
          )
        : null;
  }
  final twoWay = agreement['exchangeType'] == 'TWO_WAY';
  return AgreementProgress(
    stage: AgreementStage.plans,
    title: 'Bước 2 · Tạo và duyệt lộ trình',
    description: twoWay
        ? 'Cần hai kế hoạch đối ứng. Mỗi người tạo chiều mình dạy và xác nhận chiều mình học.'
        : 'Người dạy tạo một kế hoạch; người học xem nội dung và xác nhận đúng phiên bản.',
    waiting: waiting,
    action: action,
  );
}

AgreementProgress _schedulesProgress(
  Map<String, dynamic> path,
  List<Map<String, dynamic>> plans,
  String me,
  String base,
) {
  final waiting = <String>{};
  AgreementAction? action;
  for (final plan in plans) {
    final schedule = _map(plan['schedule']);
    if (schedule.isEmpty) {
      final mine = '${plan['teacherId']}' == me;
      waiting.add(
        mine
            ? 'Bạn cần đề xuất lịch cho kế hoạch mình dạy.'
            : 'Chờ đối tác đề xuất lịch họ dạy.',
      );
      action ??= mine
          ? AgreementAction(
              label: 'Đề xuất lịch tôi dạy',
              href: '$base/schedules/${plan['id']}',
            )
          : null;
      continue;
    }
    final status = '${schedule['status']}';
    final items = _list(schedule['items']);
    final total = int.tryParse('${plan['totalSessions']}') ?? 0;
    final complete = const {
          'PROPOSED',
          'PARTIALLY_CONFIRMED',
          'NEEDS_REVISION',
        }.contains(status) &&
        items.length == total &&
        total > 0;
    if (!complete) {
      final editable =
          '${plan['teacherId']}' == me &&
          const {
            'DRAFT',
            'PROPOSED',
            'PARTIALLY_CONFIRMED',
            'NEEDS_REVISION',
          }.contains(status);
      waiting.add(
        editable
            ? 'Bạn cần điều chỉnh lịch đủ các buổi của lộ trình.'
            : 'Lịch chưa đầy đủ hoặc cần điều chỉnh. Chờ người dạy cập nhật lịch.',
      );
      action ??= editable
          ? AgreementAction(
              label: 'Điều chỉnh lịch tôi dạy',
              href: '$base/schedules/${plan['id']}',
            )
          : AgreementAction(
              label: 'Xem trạng thái lịch',
              href: '$base/schedules',
            );
      continue;
    }
    if (!_ownConfirmation(path, schedule, me)) {
      waiting.add('Bạn cần xem và xác nhận lịch của từng kế hoạch.');
      action ??= AgreementAction(
        label: 'Xem và xác nhận lịch',
        href: '$base/schedules',
      );
      continue;
    }
    if (schedule['participantAConfirmedAt'] == null ||
        schedule['participantBConfirmedAt'] == null) {
      waiting.add('Chờ đối tác xác nhận lịch cùng phiên bản.');
    }
  }
  if (waiting.isNotEmpty) {
    return AgreementProgress(
      stage: AgreementStage.schedules,
      title: 'Bước 3 · Thống nhất lịch học',
      description:
          'Mỗi kế hoạch có lịch riêng. Cả hai cùng xác nhận từng lịch; chưa tạm giữ Credit ở bước này.',
      waiting: waiting.toList(),
      action: action,
    );
  }
  return AgreementProgress(
    stage: AgreementStage.finalize,
    title: 'Bước 3 · Kiểm tra và chốt lịch',
    description:
        'Đã đủ xác nhận. Hệ thống cần kiểm tra lịch trùng và số dư trước khi tạm giữ Credit, khóa lịch và tạo buổi học.',
    action: AgreementAction(
      label: 'Xem và chốt lịch học',
      href: '$base/schedules',
    ),
  );
}

List<(String?, String?)> _planDirections(
  Map<String, dynamic> path,
  Map<String, dynamic> agreement,
) {
  if (agreement['exchangeType'] == 'TWO_WAY') {
    return [
      (
        '${path['participantAId']}',
        '${path['participantBId']}',
      ),
      (
        '${path['participantBId']}',
        '${path['participantAId']}',
      ),
    ];
  }
  return [
    (
      agreement['teacherId']?.toString(),
      agreement['learnerId']?.toString(),
    ),
  ];
}

bool _editablePath(Map<String, dynamic> path) =>
    path['lockedVersion'] == null &&
    const {'PROPOSED', 'PARTIALLY_CONFIRMED', 'CONFIRMED'}.contains(
      path['status'],
    );

bool _agreementConfirmed(Map<String, dynamic> agreement) =>
    agreement['participantAConfirmedAt'] != null &&
    agreement['participantBConfirmedAt'] != null;

bool _plansConfirmed(
  Map<String, dynamic> path,
  Map<String, dynamic> agreement,
  List<Map<String, dynamic>> plans,
) {
  for (final pair in _planDirections(path, agreement)) {
    final plan = _planByPair(plans, pair.$1, pair.$2);
    if (plan == null ||
        plan['status'] != 'CONFIRMED' ||
        plan['learnerConfirmedAt'] == null) {
      return false;
    }
  }
  return true;
}

Map<String, dynamic>? _planByTeacher(
  List<Map<String, dynamic>> plans,
  String teacherId,
) {
  for (final plan in plans) {
    if ('${plan['teacherId']}' == teacherId) return plan;
  }
  return null;
}

Map<String, dynamic>? _planByPair(
  List<Map<String, dynamic>> plans,
  String? teacherId,
  String? learnerId,
) {
  for (final plan in plans) {
    if ('${plan['teacherId']}' == teacherId &&
        '${plan['learnerId']}' == learnerId) {
      return plan;
    }
  }
  return null;
}

bool _ownConfirmation(
  Map<String, dynamic> path,
  Map<String, dynamic> value,
  String me,
) {
  if (me.isEmpty) return false;
  final field = path['participantAId'] == me
      ? 'participantAConfirmedAt'
      : 'participantBConfirmedAt';
  return value[field] != null;
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
