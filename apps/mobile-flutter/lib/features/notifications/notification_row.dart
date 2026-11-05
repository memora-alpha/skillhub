import 'package:flutter/material.dart';

import '../../components/app_icon.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';
import '../product_shell/schema/notification_schema.dart';
import 'notification_copy.dart';
import 'notification_target.dart';

String notificationIconName(String type) {
  if (type.startsWith('chat.')) return AppIcon.message;
  if (type.startsWith('proposal.')) return AppIcon.users;
  if (type.startsWith('skill.')) return AppIcon.award;
  if (type.startsWith('learning-path.')) return AppIcon.calendar;
  if (type.startsWith('material.')) return AppIcon.book;
  if (type.startsWith('report.')) return AppIcon.flag;
  return AppIcon.bell;
}

class NotificationRow extends StatelessWidget {
  const NotificationRow({
    super.key,
    required this.item,
    required this.busy,
    required this.disabled,
    required this.onPressed,
  });

  final NotificationRecord item;
  final bool busy;
  final bool disabled;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final unread = item.unread;
    final copy = notificationCopy(item);
    final target = notificationTarget(item);
    final actionable = unread || target != null;
    return Tappable(
      semanticLabel:
          '${copy.title}. ${copy.body}. ${notificationTime(item.createdAt)}. ${unread ? 'Chưa đọc' : 'Đã đọc'}',
      onTap: actionable && !disabled ? onPressed : null,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 120),
        opacity: disabled && actionable ? 0.55 : 1,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: unread ? AppColors.primarySoft : AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(
              color: unread ? AppColors.primaryMuted : AppColors.border,
            ),
          ),
          child: Row(
            spacing: 12,
            children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: unread
                      ? AppColors.primaryMuted
                      : AppColors.surfaceLow,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: AppIcon(
                  notificationIconName(item.type),
                  size: 20,
                  color: unread ? AppColors.primary : AppColors.body,
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 3,
                  children: [
                    Row(
                      spacing: 6,
                      children: [
                        Expanded(
                          child: Text(
                            copy.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: nunito(
                              TypeScale.body,
                              weight: unread
                                  ? FontWeight.w700
                                  : FontWeight.w600,
                              color: unread
                                  ? AppColors.primary
                                  : AppColors.ink,
                            ),
                          ),
                        ),
                        if (unread)
                          Container(
                            width: 7,
                            height: 7,
                            decoration: const BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    Text(
                      copy.body,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: nunito(
                        TypeScale.secondary,
                        color: AppColors.body,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        notificationTime(item.createdAt),
                        style: nunito(
                          TypeScale.caption,
                          color: AppColors.body,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (busy)
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              else if (target != null)
                const AppIcon(
                  AppIcon.chevron,
                  size: 16,
                  color: AppColors.body,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
