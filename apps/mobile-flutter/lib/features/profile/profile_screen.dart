import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../shell/app_screen_layout.dart';
import '../shell/navigation.dart';
import '../remote/refresh_signal.dart';
import 'profile_widgets.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(accountSessionProvider);
    if (session == null) return const SizedBox.shrink();
    final profile = session.profile;
    void open(String label) =>
        openAppAction(context, label, noticeBody: profileNoticeBody);
    return AppScreenLayout(
      title: 'Hồ sơ',
      selected: 'Hồ sơ',
      background: Chrome.background,
      surface: Chrome.surface,
      noticeBody: (label) => label == 'Thông báo' ? null : profileNoticeBody(label),
      child: RefreshIndicator(
        onRefresh: () async {
          ref.read(refreshTicksProvider.notifier).bump(const {RefreshScope.profile});
          await ref.read(accountProvider.notifier).reload();
        },
        child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 12,
                children: [
                  ProfileSummary(
                    profile: profile,
                    onEdit: () => context.push('/edit-profile'),
                    avatarNotice: const AvatarUploadNotice(),
                  ),
                  AppButton(
                    label: 'Xem hồ sơ công khai',
                    variant: ButtonVariant.secondary,
                    onPressed: () => context.push('/profiles/${profile.userId}'),
                  ),
                  ProfileShortcuts(
                    onOpen: open,
                    onSettings: () => context.push('/account-settings'),
                  ),
                  AppButton(
                    label: 'Bộ giao diện mobile',
                    variant: ButtonVariant.paper,
                    onPressed: () => open('Bộ giao diện mobile'),
                  ),
                  ProfileAbout(bio: profile.bio),
                  ProfileSkills(onManage: () => open('Kỹ năng')),
                ],
              ),
            ),
          ),
        ],
        ),
      ),
    );
  }
}

class PublicProfileScreen extends ConsumerWidget {
  const PublicProfileScreen({super.key, required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(accountSessionProvider);
    if (session == null) return const SizedBox.shrink();
    final own = userId == session.userId;
    return AppScreenLayout(
      title: 'Hồ sơ công khai',
      back: (route: '/profile', label: 'Quay lại hồ sơ'),
      background: Chrome.background,
      surface: Chrome.surface,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 12,
                children: own
                    ? [
                        Text('Xem trước hồ sơ công khai', style: profileCaption),
                        ProfileSummary(profile: session.profile),
                        ProfileAbout(bio: session.profile.bio),
                        const ProfileSkills(),
                      ]
                    : [
                        Text('Hồ sơ công khai', style: profileCaption),
                        ProfileSection(
                          children: [
                            const ProfileHeading(title: 'Hồ sơ không khả dụng'),
                            Text(
                              'Hồ sơ của người dùng khác sẽ có khi API hồ sơ công khai được kết nối.',
                              style: profileBody,
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
