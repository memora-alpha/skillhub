import 'package:flutter/material.dart';

import '../../components/app_icon.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';
import 'navigation.dart';

/// Resolves to the chosen item label, `logout`, or null when dismissed.
Future<String?> showAccountMenu(BuildContext context, AccountSession session) {
  return showGeneralDialog<String>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Đóng menu tài khoản',
    barrierColor: const Color(0x00000000),
    transitionDuration: Duration.zero,
    pageBuilder: (dialogContext, _, _) {
      final top = MediaQuery.paddingOf(dialogContext).top + 56;
      Widget item(String label, String icon, String result, {bool danger = false}) =>
          InkWell(
            onTap: () => Navigator.of(dialogContext).pop(result),
            highlightColor: AppColors.canvas,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                spacing: 12,
                children: [
                  AppIcon(
                    icon,
                    size: IconSizes.control,
                    color: danger ? AppColors.error : AppColors.muted,
                  ),
                  Text(
                    label,
                    style: nunito(
                      (14, 20),
                      color: danger ? AppColors.error : AppColors.body,
                    ),
                  ),
                ],
              ),
            ),
          );
      return Stack(
        children: [
          Positioned(
            top: top,
            right: 16,
            width: 224,
            child: Semantics(
              scopesRoute: true,
              explicitChildNodes: true,
              namesRoute: true,
              label: 'Menu tài khoản',
              child: Material(
                color: AppColors.surface,
                elevation: 4,
                shadowColor: AppColors.ink.withValues(alpha: 0.4),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  side: const BorderSide(color: AppColors.border),
                ),
                clipBehavior: Clip.antiAlias,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        decoration: const BoxDecoration(
                          border: Border(
                            bottom: BorderSide(color: AppColors.border),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              session.name,
                              style: nunito(
                                (14, 20),
                                weight: FontWeight.w600,
                                color: AppColors.ink,
                              ),
                            ),
                            Text(
                              session.email,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: nunito((12, 16), color: AppColors.muted),
                            ),
                          ],
                        ),
                      ),
                      for (final entry in accountItems)
                        item(entry.label, entry.icon, entry.label),
                      Container(
                        margin: const EdgeInsets.only(top: 4),
                        padding: const EdgeInsets.only(top: 4),
                        decoration: const BoxDecoration(
                          border: Border(
                            top: BorderSide(color: AppColors.border),
                          ),
                        ),
                        child: item(
                          'Đăng xuất',
                          AppIcon.logout,
                          'logout',
                          danger: true,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      );
    },
  );
}
