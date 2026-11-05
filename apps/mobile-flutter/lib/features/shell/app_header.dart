import 'package:flutter/material.dart';

import '../../components/app_icon.dart';
import '../../components/avatar.dart';
import '../../components/misc.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';
import '../auth/session/auth_session.dart';

class AppHeader extends StatelessWidget {
  const AppHeader({
    super.key,
    required this.session,
    required this.onAction,
    required this.onAccount,
    this.title,
    this.titleContent,
    this.centeredTitle = false,
    this.onBack,
    this.backLabel = 'Quay lại hồ sơ',
    this.rightAction,
    this.unreadCount = 0,
    this.navigationBlocked = false,
  });

  final AccountSession session;
  final ValueChanged<String> onAction;
  final VoidCallback onAccount;
  final String? title;
  final Widget? titleContent;
  final bool centeredTitle;
  final VoidCallback? onBack;
  final String backLabel;
  final Widget? rightAction;
  final int unreadCount;
  final bool navigationBlocked;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final width = media.size.width;
    final compact = width / media.textScaler.scale(1) < 640;
    final unread = unreadCount;
    final titled = title != null || titleContent != null;
    final showBell = onBack == null;
    VoidCallback? action(VoidCallback? tap) =>
        navigationBlocked || tap == null ? null : tap;

    return Container(
      constraints: const BoxConstraints(minHeight: 64),
      padding: EdgeInsets.symmetric(
        horizontal: width < 380 ? 12 : (titled ? 16 : 24),
        vertical: centeredTitle ? 6 : 8,
      ),
      color: Chrome.background,
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (title != null && centeredTitle && titleContent == null)
            Positioned(
              left: 52,
              right: 52,
              top: 0,
              bottom: 0,
              child: IgnorePointer(
                child: Center(
                  child: Text(
                    title!,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: nunito(
                      (16, 22),
                      weight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                ),
              ),
            ),
          Row(
            spacing: titled ? 6 : 12,
            children: [
              if (onBack != null)
                Tappable(
                  semanticLabel: backLabel,
                  onTap: action(onBack),
                  child: Opacity(
                    opacity: navigationBlocked ? 0.5 : 1,
                    child: Padding(
                      padding: const EdgeInsets.all(6),
                      child: Transform.rotate(
                        angle: 3.14159,
                        child: const AppIcon(
                          AppIcon.arrow,
                          size: 20,
                          color: AppColors.muted,
                        ),
                      ),
                    ),
                  ),
                )
              else if (!compact || title == null)
                Tappable(
                  semanticLabel: 'SkillHub — trang chủ',
                  onTap: action(() => onAction('Trang chủ')),
                  child: BrandLogo(
                    home: true,
                    markOnly: title != null && width < 480,
                  ),
                ),
              if (titleContent != null)
                Expanded(child: titleContent!)
              else if (title != null && centeredTitle)
                const Spacer()
              else if (title != null)
                Expanded(
                  child: Text(
                    title!,
                    maxLines: width < 400 ? 2 : 1,
                    overflow: TextOverflow.ellipsis,
                    style: nunito(
                      (18, 26),
                      weight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                )
              else
                const Spacer(),
              if (title != null && centeredTitle && titleContent == null)
                const Spacer(),
              Row(
                mainAxisSize: MainAxisSize.min,
                spacing: 4,
                children: [
                  if (!compact)
                    Tappable(
                      semanticLabel: 'Tin nhắn',
                      onTap: action(() => onAction('Tin nhắn')),
                      child: const Padding(
                        padding: EdgeInsets.all(9),
                        child: AppIcon(
                          AppIcon.message,
                          size: IconSizes.control,
                          color: AppColors.muted,
                        ),
                      ),
                    ),
                  if (showBell)
                    Tappable(
                      semanticLabel: unread > 0
                          ? 'Thông báo — ${unread > 99 ? 'hơn 99' : unread} thông báo chưa đọc'
                          : 'Mở thông báo',
                      onTap: action(() => onAction('Thông báo')),
                      child: SizedBox(
                        width: 36,
                        height: 36,
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            Container(
                              decoration: BoxDecoration(
                                color: AppColors.white,
                                shape: BoxShape.circle,
                                border: Border.all(color: Chrome.border),
                              ),
                              alignment: Alignment.center,
                              child: const AppIcon(
                                AppIcon.bell,
                                size: IconSizes.control,
                                color: Chrome.accent,
                              ),
                            ),
                            if (unread > 0)
                              Positioned(
                                right: -4,
                                top: -7,
                                child: Container(
                                  constraints: const BoxConstraints(
                                    minWidth: 16,
                                    maxHeight: 16,
                                  ),
                                  height: 16,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 3,
                                  ),
                                  alignment: Alignment.center,
                                  decoration: const BoxDecoration(
                                    color: AppColors.primary,
                                    borderRadius: BorderRadius.all(
                                      Radius.circular(8),
                                    ),
                                  ),
                                  child: Text(
                                    unread > 99 ? '99+' : '$unread',
                                    style: const TextStyle(
                                      fontFamily: Fonts.nunito,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 10,
                                      height: 1.2,
                                      color: AppColors.white,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ?rightAction,
                  if (!compact)
                    Padding(
                      padding: const EdgeInsets.only(left: 4),
                      child: Tappable(
                        semanticLabel: 'Mở menu tài khoản',
                        onTap: action(onAccount),
                        child: Avatar(
                          name: session.name,
                          userId: session.userId,
                          size: AvatarSizes.compact,
                          imageUrl: session.avatarUrl,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
