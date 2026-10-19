import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/avatar.dart';
import '../../components/misc.dart';
import '../../core/theme/tokens.dart';
import '../discovery/discovery_data.dart';
import '../shell/app_screen_layout.dart';
import 'public_profiles_data.dart';

class UserProfileScreen extends ConsumerWidget {
  const UserProfileScreen({super.key, required this.id, this.requestId});

  final String id;
  final String? requestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(publicProfileProvider(id)).value;
    final request = (ref.watch(learningRequestsProvider).value ?? const <LearningRequest>[])
        .where((r) => r.id == requestId && r.userId == profile?.id)
        .firstOrNull;
    final back = request != null ? '/request/${request.id}' : '/proposals';
    final body = nunito(TypeScale.body, color: Palette.body);
    final heroBody = nunito(TypeScale.body, color: Palette.sand);
    final caption = nunito(TypeScale.secondary, color: Palette.muted);
    final heading = nunito(
      TypeScale.heading,
      weight: FontWeight.w700,
      color: Palette.ink,
    );
    final label = nunito(
      TypeScale.body,
      weight: FontWeight.w600,
      color: Palette.ink,
    );

    Widget section(String title, List<Widget> children) => Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Chrome.surface,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 12,
        children: [
          Semantics(header: true, child: Text(title, style: heading)),
          ...children,
        ],
      ),
    );

    Widget stars(int count, double size, Color color) => Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 2,
      children: [
        for (var star = 1; star <= 5; star++)
          AppIcon(AppIcon.star, size: size, filled: star <= count, color: color),
      ],
    );

    return AppScreenLayout(
      title: 'Hồ sơ công khai',
      selected: 'Khám phá',
      back: (route: back, label: 'Quay lại'),
      child: profile == null
          ? EmptyState(
              title: 'Không tìm thấy hồ sơ',
              description: 'Hồ sơ này không có trên máy chủ.',
              action: 'Quay lại khám phá',
              onAction: () => context.go('/discover'),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 840),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: 16,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Palette.ink,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            spacing: 8,
                            children: [
                              Avatar(
                                name: profile.name,
                                userId: profile.id,
                                size: 72,
                              ),
                              Semantics(
                                header: true,
                                child: SelectableText(
                                  profile.name,
                                  style: fraunces(
                                    26,
                                    34,
                                    weight: FontWeight.w700,
                                    color: Palette.white,
                                  ),
                                ),
                              ),
                              if (profile.headline != null)
                                Text(profile.headline!, style: heroBody),
                              Wrap(
                                spacing: 16,
                                children: [
                                  if (profile.rating != null)
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      spacing: 6,
                                      children: [
                                        const AppIcon(
                                          AppIcon.star,
                                          size: 14,
                                          filled: true,
                                          color: Palette.star,
                                        ),
                                        Text(profile.rating!, style: heroBody),
                                      ],
                                    ),
                                  if (profile.reputation != null)
                                    Text(
                                      '${profile.reputation} Reputation',
                                      style: heroBody,
                                    ),
                                ],
                              ),
                              Text(
                                'Hồ sơ mẫu',
                                style: nunito(
                                  TypeScale.caption,
                                  weight: FontWeight.w500,
                                  color: Palette.brandMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (profile.stats case final stats?)
                          Row(
                            spacing: 8,
                            children: [
                              for (final stat in stats)
                                Expanded(
                                  child: Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: Chrome.surface,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Column(
                                      spacing: 4,
                                      children: [
                                        SelectableText(
                                          stat.value,
                                          style: nunito(
                                            TypeScale.title,
                                            weight: FontWeight.w700,
                                            color: Palette.brandHover,
                                          ),
                                        ),
                                        Text(stat.label, style: caption),
                                      ],
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        section('Giới thiệu', [
                          SelectableText(
                            profile.bio ??
                                'Người dùng chưa viết phần giới thiệu.',
                            style: body,
                          ),
                        ]),
                        section('Kỹ năng chia sẻ', [
                          if (profile.skills.isEmpty)
                            Text(
                              'Chưa có kỹ năng chia sẻ.',
                              style: body,
                            ),
                          for (final skill in profile.skills)
                            Container(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              decoration: const BoxDecoration(
                                border: Border(
                                  bottom: BorderSide(color: Chrome.border),
                                ),
                              ),
                              child: Row(
                                spacing: 8,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      spacing: 6,
                                      children: [
                                        Text(skill.name, style: label),
                                        AppBadge(
                                          label: skill.verified
                                              ? 'Đã xác minh'
                                              : 'Chưa xác minh',
                                          variant: skill.verified
                                              ? BadgeVariant.sage
                                              : BadgeVariant.neutral,
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(skill.level, style: caption),
                                ],
                              ),
                            ),
                        ]),
                        section('Đánh giá', [
                          if (profile.reviews?.isEmpty ?? true)
                            Text(
                              'Chưa có đánh giá.',
                              style: body,
                            ),
                          for (final review in profile.reviews ?? const <DemoReview>[])
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                spacing: 8,
                                children: [
                                  Wrap(
                                    spacing: 6,
                                    crossAxisAlignment:
                                        WrapCrossAlignment.center,
                                    children: [
                                      Avatar(name: review.name, size: 28),
                                      Text(review.name, style: label),
                                      Semantics(
                                        label: '${review.stars}/5 sao',
                                        child: stars(
                                          review.stars,
                                          12,
                                          Palette.gold,
                                        ),
                                      ),
                                    ],
                                  ),
                                  SelectableText(review.text, style: body),
                                ],
                              ),
                            ),
                        ]),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            if (request != null)
                              AppButton(
                                label: 'Xem yêu cầu',
                                variant: ButtonVariant.secondary,
                                minHeight: 48,
                                onPressed: () => context.canPop()
                                    ? context.pop()
                                    : context.go(back),
                              ),
                            AppButton(
                              label: request != null
                                  ? 'Gửi đề xuất'
                                  : 'Gửi lời mời trao đổi',
                              minHeight: 48,
                              onPressed: () => context.push(
                                request != null
                                    ? '/send-proposal?requestId=${request.id}'
                                    : '/send-proposal?userId=${profile.id}',
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
