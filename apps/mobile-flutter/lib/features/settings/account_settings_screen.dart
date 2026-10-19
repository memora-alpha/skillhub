import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/dialogs.dart';
import '../../components/misc.dart';
import '../../core/http/app_error.dart';
import '../../core/theme/tokens.dart';
import '../../core/toast/toast.dart';
import '../auth/session/auth_session.dart';
import '../shell/app_screen_layout.dart';

const appVersion = '1.0.0';

const _aboutBody =
    'Chia sẻ điều bạn biết. Học điều bạn muốn.\n\n'
    'SkillHub kết nối người học và người chia sẻ kỹ năng.\n'
    'Phiên bản $appVersion.';

class AccountSettingsScreen extends ConsumerWidget {
  const AccountSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    void notice(String title, String body) =>
        showInfoModal(context, title: title, body: body);

    return AppScreenLayout(
      title: 'Cài đặt',
      selected: 'Cài đặt',
      back: (route: '/profile', label: 'Quay lại hồ sơ'),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 24,
                children: [
                  ActionGroup(
                    title: 'Tài khoản và bảo mật',
                    children: [
                      ActionRow(
                        icon: AppIcon.user,
                        label: 'Tài khoản',
                        description: 'Email đăng nhập và trạng thái xác minh',
                        onPressed: () => context.push('/account-details'),
                      ),
                      ActionRow(
                        icon: AppIcon.lock,
                        label: 'Đặt lại mật khẩu',
                        description: 'Xác minh qua email để tạo mật khẩu mới',
                        onPressed: () => context.push('/forgot-password'),
                      ),
                      ActionRow(
                        icon: AppIcon.shield,
                        label: 'Đăng xuất tất cả thiết bị',
                        description:
                            'Kết thúc các phiên đăng nhập đang hoạt động',
                        onPressed: () => showAppDialog<void>(
                          context,
                          builder: (_) => const _SignOutAllDialog(),
                        ),
                      ),
                    ],
                  ),
                  ActionGroup(
                    title: 'Tùy chọn ứng dụng',
                    children: [
                      ActionRow(
                        icon: AppIcon.clock,
                        label: 'Múi giờ',
                        description: 'Xem lựa chọn và đồng hồ mẫu',
                        onPressed: () => context.push('/preferences/timezone'),
                      ),
                      ActionRow(
                        icon: AppIcon.book,
                        label: 'Ngôn ngữ',
                        description: 'Tiếng Việt / English · bản xem thử',
                        onPressed: () => context.push('/preferences/language'),
                      ),
                      ActionRow(
                        icon: AppIcon.bell,
                        label: 'Thông báo',
                        description:
                            'Tùy chỉnh nhóm thông báo trong bản xem thử',
                        onPressed: () =>
                            context.push('/preferences/notifications'),
                      ),
                      ActionRow(
                        icon: AppIcon.shield,
                        label: 'Quyền riêng tư',
                        description: 'Thông tin công khai và riêng tư',
                        onPressed: () => context.push('/preferences/privacy'),
                      ),
                    ],
                  ),
                  ActionGroup(
                    title: 'Thông tin và hỗ trợ',
                    children: [
                      ActionRow(
                        icon: AppIcon.help,
                        label: 'Trợ giúp',
                        description: 'Hồ sơ, ảnh đại diện và bảo mật',
                        onPressed: () => context.push('/help'),
                      ),
                      ActionRow(
                        icon: AppIcon.compass,
                        label: 'Giới thiệu SkillHub',
                        description: 'Thông tin ứng dụng và phiên bản',
                        onPressed: () =>
                            notice('Giới thiệu SkillHub', _aboutBody),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Column(
                      spacing: 8,
                      children: [
                        SizedBox(
                          width: double.infinity,
                          child: AppButton(
                            variant: ButtonVariant.ghost,
                            semanticLabel: 'Đăng xuất',
                            minHeight: 48,
                            backgroundColor: AppColors.errorLight,
                            border: Border.all(color: AppColors.error),
                            onPressed: () async {
                              if (await showLogoutDialog(context) &&
                                  context.mounted) {
                                unawaited(
                                  ref
                                      .read(authRuntimeProvider)
                                      .controller
                                      .signOut(),
                                );
                                context.go('/login');
                              }
                            },
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              spacing: 8,
                              children: [
                                const AppIcon(
                                  AppIcon.logout,
                                  size: 20,
                                  color: AppColors.error,
                                ),
                                Text(
                                  'Đăng xuất',
                                  style: nunito(
                                    TypeScale.body,
                                    weight: FontWeight.w700,
                                    color: AppColors.error,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        Text(
                          'SkillHub $appVersion',
                          style: nunito(
                            TypeScale.caption,
                            color: AppColors.inkSoft,
                          ),
                        ),
                      ],
                    ),
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

class _SignOutAllDialog extends ConsumerStatefulWidget {
  const _SignOutAllDialog();

  @override
  ConsumerState<_SignOutAllDialog> createState() => _SignOutAllDialogState();
}

class _SignOutAllDialogState extends ConsumerState<_SignOutAllDialog> {
  bool _busy = false;

  Future<void> _confirm() async {
    if (_busy) return;
    final toast = ref.read(toastProvider.notifier);
    toast.dismiss();
    setState(() => _busy = true);
    try {
      await ref.read(authRuntimeProvider).controller.signOutAll();
    } catch (error) {
      toast.show(errorMessage(error), ToastTone.error);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_busy,
      child: InfoModalCard(
        title: 'Đăng xuất tất cả thiết bị?',
        body:
            'Bạn sẽ được đăng xuất trên thiết bị này và các thiết bị khác. '
            'Cần đăng nhập lại để tiếp tục sử dụng SkillHub.',
        confirmLabel: _busy ? 'Đang đăng xuất...' : 'Đăng xuất tất cả',
        confirmDisabled: _busy,
        onConfirm: _confirm,
        onClose: () {
          if (!_busy) Navigator.of(context).pop();
        },
      ),
    );
  }
}
