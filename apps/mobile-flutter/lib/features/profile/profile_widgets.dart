import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/avatar.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';
import '../account/schema/account_schema.dart';
import '../auth/session/avatar_monitor.dart';

const _statColors = [ProfileColors.accent, Color(0xFF2B9D91), Color(0xFFE66B4A)];

final profileHeading = nunito(
  TypeScale.heading,
  weight: FontWeight.w700,
  color: ProfileColors.ink,
);
final profileLabel = nunito(
  TypeScale.body,
  weight: FontWeight.w500,
  color: ProfileColors.ink,
);
final profileBody = nunito(TypeScale.body, color: ProfileColors.body);
final profileCaption = nunito(TypeScale.secondary, color: ProfileColors.muted);

String profileNoticeBody(String label) => switch (label) {
  'Ví Credit' => 'Chức năng ví và giao dịch Credit chưa được kết nối.',
  'Kỹ năng' => 'Danh sách kỹ năng chưa được kết nối.',
  'Thành tích' => 'Quản lý danh hiệu sẽ được bổ sung sau.',
  'Xác minh kỹ năng' =>
    'Chức năng gửi bằng chứng và theo dõi xác minh kỹ năng chưa được kết nối.',
  _ => 'Màn ${label.toLowerCase()} sẽ được triển khai ở bước tiếp theo.',
};

class ProfileSection extends StatelessWidget {
  const ProfileSection({super.key, required this.children, this.spacing = 0});

  final List<Widget> children;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ProfileColors.surface,
        borderRadius: BorderRadius.circular(Radii.card),
        border: Border.all(color: ProfileColors.border),
        boxShadow: Shadows.profileSection,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: spacing,
        children: children,
      ),
    );
  }
}

class ProfileHeading extends StatelessWidget {
  const ProfileHeading({super.key, required this.title, this.action, this.onTap});

  final String title;
  final String? action;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        spacing: 8,
        children: [
          Flexible(
            child: Semantics(
              header: true,
              child: Text(title, style: profileHeading),
            ),
          ),
          if (action != null)
            Tappable(
              semanticLabel: '$action — $title',
              onTap: onTap,
              child: Text(
                action!,
                style: nunito(
                  TypeScale.secondary,
                  weight: FontWeight.w600,
                  color: ProfileColors.accent,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class ProfileSummary extends StatelessWidget {
  const ProfileSummary({
    super.key,
    required this.profile,
    this.onEdit,
    this.avatarNotice,
  });

  final OwnProfile profile;
  final VoidCallback? onEdit;
  final Widget? avatarNotice;

  @override
  Widget build(BuildContext context) {
    final stats = [
      (profile.reputationScore?.toString(), 'Điểm uy tín', false),
      (profile.verifiedSkillCount.toString(), 'Kỹ năng đã xác minh', false),
      (null, 'Lộ trình hoàn thành', true),
    ];
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ProfileColors.surface,
        borderRadius: BorderRadius.circular(Radii.card),
        border: Border.all(color: ProfileColors.border),
        boxShadow: Shadows.profileHero,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 10,
        children: [
          _ProfileHero(profile: profile, onEdit: onEdit),
          ?avatarNotice,
          Row(
            spacing: 6,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < stats.length; i++)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Column(
                      children: [
                        Text(
                          stats[i].$1 ?? '—',
                          style: nunito(
                            TypeScale.body,
                            weight: FontWeight.w700,
                            color: stats[i].$3
                                ? ProfileColors.muted
                                : _statColors[i],
                          ).copyWith(
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                        Text(
                          stats[i].$2,
                          textAlign: TextAlign.center,
                          style: _statLabel,
                        ),
                        if (stats[i].$3)
                          Text(
                            'Sắp có',
                            textAlign: TextAlign.center,
                            style: _statLabel,
                          ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  static final _statLabel = nunito(
    TypeScale.caption,
    weight: FontWeight.w600,
    color: ProfileColors.muted,
  );
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({required this.profile, this.onEdit});

  final OwnProfile profile;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final tagline = nunito(TypeScale.secondary, color: ProfileColors.muted);
    return Padding(
      padding: const EdgeInsets.only(left: 2, right: 2, top: 1),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Avatar(
                name: profile.fullName,
                userId: profile.userId,
                size: AvatarSizes.profile,
                imageUrl: profile.avatarUrl,
              ),
              if (onEdit != null)
                Tappable(
                  semanticLabel: 'Chỉnh sửa hồ sơ',
                  pressedOpacity: 0.7,
                  onTap: onEdit,
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 36),
                    padding: const EdgeInsets.symmetric(horizontal: 9),
                    decoration: BoxDecoration(
                      color: ProfileColors.surface,
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(color: ProfileColors.border),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      spacing: 4,
                      children: [
                        const AppIcon(
                          AppIcon.edit,
                          size: IconSizes.inline,
                          color: ProfileColors.ink,
                        ),
                        Text(
                          'Chỉnh sửa',
                          style: nunito(
                            TypeScale.caption,
                            weight: FontWeight.w600,
                            color: ProfileColors.ink,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Semantics(
            header: true,
            child: Text(
              profile.fullName,
              style: nunito(
                TypeScale.title,
                weight: FontWeight.w700,
                color: ProfileColors.ink,
              ),
            ),
          ),
          if (profile.headline.trim().isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 1),
              child: Text(profile.headline, style: tagline),
            ),
          if (onEdit != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                spacing: 5,
                children: [
                  const AppIcon(
                    AppIcon.award,
                    size: IconSizes.inline,
                    color: ProfileColors.muted,
                  ),
                  Text('Danh hiệu · Sắp có', style: tagline),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class ProfileAbout extends StatelessWidget {
  const ProfileAbout({super.key, required this.bio});

  final String bio;

  @override
  Widget build(BuildContext context) {
    return ProfileSection(
      children: [
        const ProfileHeading(title: 'Giới thiệu'),
        SelectableText(
          bio.trim().isNotEmpty ? bio : 'Chưa có giới thiệu.',
          style: profileBody,
        ),
      ],
    );
  }
}

class ProfileSkills extends StatelessWidget {
  const ProfileSkills({super.key, this.onManage});

  final VoidCallback? onManage;

  @override
  Widget build(BuildContext context) {
    return ProfileSection(
      children: [
        ProfileHeading(
          title: 'Kỹ năng chia sẻ',
          action: onManage == null ? null : 'Quản lý',
          onTap: onManage,
        ),
        Text('Danh sách kỹ năng chưa được kết nối.', style: profileCaption),
      ],
    );
  }
}

const _shortcuts = [
  ('Ví Credit', AppIcon.wallet, AppColors.brand, Color(0xFFFFF1E9)),
  ('Tài liệu của tôi', AppIcon.book, AppColors.sage, Color(0xFFEAF8F6)),
  ('Thành tích', AppIcon.award, AppColors.gold, Color(0xFFFFF7DE)),
  ('Xác minh kỹ năng', AppIcon.shield, Color(0xFF6B3DB5), Color(0xFFF0EEFF)),
  ('Đánh giá', AppIcon.star, Color(0xFFF59E0B), Color(0xFFFFF7DE)),
  ('Cài đặt', AppIcon.settings, AppColors.inkSoft, ProfileColors.neutral),
];

class ProfileShortcuts extends StatelessWidget {
  const ProfileShortcuts({
    super.key,
    required this.onOpen,
    required this.onSettings,
  });

  final ValueChanged<String> onOpen;
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = (constraints.maxWidth - 8) / 2;
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final (label, icon, color, tint) in _shortcuts)
              SizedBox(
                width: width,
                child: Tappable(
                  semanticLabel: label,
                  pressedOpacity: 0.85,
                  onTap: () =>
                      icon == AppIcon.settings ? onSettings() : onOpen(label),
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 56),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: ProfileColors.surface,
                      borderRadius: BorderRadius.circular(Radii.card),
                      border: Border.all(color: ProfileColors.border),
                      boxShadow: Shadows.profileAction,
                    ),
                    child: Row(
                      spacing: 7,
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: tint,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: AppIcon(
                            icon,
                            size: IconSizes.control,
                            color: color,
                            filled: false,
                          ),
                        ),
                        Expanded(child: Text(label, style: profileLabel)),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Lets the user re-check an avatar that failed or is taking too long.
class AvatarUploadNotice extends ConsumerWidget {
  const AvatarUploadNotice({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final avatar = ref.watch(avatarMonitorProvider);
    if (avatar == null ||
        (avatar.error == null &&
            !(avatar.upload.status == AvatarStatus.quarantined &&
                avatar.waitingTooLong))) {
      return const SizedBox.shrink();
    }
    return AppButton(
      label: 'Kiểm tra lại ảnh',
      variant: ButtonVariant.ghost,
      disabled: avatar.checking,
      onPressed: () => ref.read(avatarMonitorProvider.notifier).retry(),
    );
  }
}
