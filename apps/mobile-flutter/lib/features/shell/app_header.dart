import 'package:flutter/foundation.dart';
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
    this.onBack,
    this.backLabel = 'Quay lại hồ sơ',
    this.rightAction,
    this.unreadCount = 0,
  });

  final AccountSession session;
  final ValueChanged<String> onAction;
  final VoidCallback onAccount;
  final String? title;
  final VoidCallback? onBack;
  final String backLabel;
  final Widget? rightAction;
  final int unreadCount;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final compact = !kIsWeb || width < 640;
    final unread = unreadCount;
    final titled = title != null;
    return Container(
      constraints: const BoxConstraints(minHeight: 64),
      padding: EdgeInsets.symmetric(horizontal: titled ? 16 : 24, vertical: 8),
      color: Chrome.background,
      child: Row(
        spacing: titled ? 6 : 12,
        children: [
          if (onBack != null)
            Tappable(
              semanticLabel: backLabel,
              onTap: onBack,
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
            )
          else if (!compact || !titled)
            Tappable(
              semanticLabel: 'SkillHub — trang chủ',
              onTap: () => onAction('Trang chủ'),
              child: BrandLogo(home: true, markOnly: titled && width < 480),
            ),
          if (titled)
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
          Row(
            mainAxisSize: MainAxisSize.min,
            spacing: 4,
            children: [
              if (!compact)
                Tappable(
                  semanticLabel: 'Tin nhắn',
                  onTap: () => onAction('Tin nhắn'),
                  child: const Padding(
                    padding: EdgeInsets.all(9),
                    child: AppIcon(
                      AppIcon.message,
                      size: IconSizes.control,
                      color: AppColors.muted,
                    ),
                  ),
                ),
              Tappable(
                semanticLabel: 'Thông báo — $unread chưa đọc',
                onTap: () => onAction('Thông báo'),
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
                      Positioned(
                        right: 2,
                        top: 1,
                        child: Container(
                          width: 14,
                          height: 14,
                          alignment: Alignment.center,
                          decoration: const BoxDecoration(
                            color: Chrome.accent,
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            '$unread',
                            style: const TextStyle(
                              fontFamily: Fonts.nunito,
                              fontWeight: FontWeight.w700,
                              fontSize: 9,
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
                    onTap: onAccount,
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
    );
  }
}
