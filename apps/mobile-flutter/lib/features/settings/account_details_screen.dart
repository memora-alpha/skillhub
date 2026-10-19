import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../components/app_icon.dart';
import '../../components/misc.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import '../shell/app_screen_layout.dart';

const _accountStatuses = {
  'ACTIVE': ('Đang hoạt động', BadgeVariant.success),
  'PENDING_VERIFICATION': ('Chờ xác minh', BadgeVariant.warning),
  'LOCKED': ('Đã khóa', BadgeVariant.warning),
  'SUSPENDED': ('Tạm đình chỉ', BadgeVariant.warning),
  'DEACTIVATED': ('Đã vô hiệu hóa', BadgeVariant.neutral),
};

class AccountDetailsScreen extends ConsumerWidget {
  const AccountDetailsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(accountSessionProvider);
    if (session == null) return const SizedBox.shrink();
    final account = session.account;
    final status =
        _accountStatuses[account.accountStatus] ??
        (account.accountStatus, BadgeVariant.neutral);
    final caption = nunito(TypeScale.secondary, color: AppColors.inkSoft);
    final label = nunito(
      TypeScale.secondary,
      weight: FontWeight.w600,
      color: AppColors.inkSoft,
    );
    final statusLabel = nunito(
      TypeScale.body,
      weight: FontWeight.w500,
      color: AppColors.body,
    );
    final card = BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.card),
      border: Border.all(color: AppColors.border),
    );

    Widget statusRow(String text, String badge, BadgeVariant variant) =>
        Container(
          constraints: const BoxConstraints(minHeight: 64),
          padding: const EdgeInsets.all(16),
          child: Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 12,
            runSpacing: 8,
            children: [
              Text(text, style: statusLabel),
              AppBadge(label: badge, variant: variant),
            ],
          ),
        );

    return AppScreenLayout(
      title: 'Tài khoản',
      selected: 'Cài đặt',
      back: (route: '/account-settings', label: 'Quay lại cài đặt'),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 24,
                children: [
                  Row(
                    spacing: 12,
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(AppRadii.card),
                        ),
                        child: const AppIcon(
                          AppIcon.lock,
                          size: 24,
                          color: AppColors.primary,
                        ),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          spacing: 4,
                          children: [
                            Semantics(
                              header: true,
                              child: Text(
                                'Thông tin đăng nhập',
                                style: nunito(
                                  TypeScale.title,
                                  weight: FontWeight.w700,
                                  color: AppColors.ink,
                                ),
                              ),
                            ),
                            Text(
                              'Email và trạng thái tài khoản của bạn.',
                              style: caption,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: card,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      spacing: 8,
                      children: [
                        Text('Email đăng nhập', style: label),
                        SelectableText(
                          account.email,
                          style: nunito(
                            TypeScale.heading,
                            weight: FontWeight.w700,
                            color: AppColors.ink,
                          ),
                        ),
                        Text(
                          'Dùng để đăng nhập và nhận mã xác minh.',
                          style: caption,
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    spacing: 8,
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Semantics(
                          header: true,
                          child: Text('Trạng thái', style: label),
                        ),
                      ),
                      Container(
                        decoration: card,
                        clipBehavior: Clip.antiAlias,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            statusRow(
                              'Xác minh email',
                              account.emailVerified
                                  ? 'Đã xác minh'
                                  : 'Chưa xác minh',
                              account.emailVerified
                                  ? BadgeVariant.success
                                  : BadgeVariant.warning,
                            ),
                            const Divider(
                              height: 1,
                              thickness: 1,
                              color: AppColors.border,
                            ),
                            statusRow(
                              'Trạng thái tài khoản',
                              status.$1,
                              status.$2,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 8,
                    children: [
                      const AppIcon(
                        AppIcon.shield,
                        size: 18,
                        color: AppColors.muted,
                      ),
                      Expanded(
                        child: Text(
                          'Chỉ bạn xem được thông tin này. Email đăng nhập không hiển thị trên hồ sơ công khai.',
                          style: caption,
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
