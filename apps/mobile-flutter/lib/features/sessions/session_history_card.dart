import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_button.dart';
import '../../components/app_icon.dart';
import '../../components/misc.dart';
import '../../core/theme/tokens.dart';
import 'live_sessions.dart';
import 'session_presentation.dart';

/// RN `SessionCard` / session panel visual clone.
class SessionHistoryCard extends StatelessWidget {
  const SessionHistoryCard({
    super.key,
    required this.session,
    this.openLabel,
  });

  final Map<String, dynamic> session;
  final String? openLabel;

  @override
  Widget build(BuildContext context) {
    final presentation = sessionPresentation(session);
    final label = presentation.label == 'Đã kết thúc · chờ xác nhận'
        ? 'Chờ xác nhận'
        : presentation.label;
    final start = sessionInstant(session['startAt']);
    final minutes = sessionMinutes(session);
    final action = openLabel ?? 'Mở buổi học';
    final badgeVariant = switch (presentation.variant) {
      SessionPresentationVariant.success => BadgeVariant.success,
      SessionPresentationVariant.warning => BadgeVariant.warning,
      SessionPresentationVariant.sage => BadgeVariant.sage,
      SessionPresentationVariant.def => BadgeVariant.neutral,
    };

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.feature),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 16,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 8,
            children: [
              Expanded(
                child: Text(
                  'Buổi học',
                  style: nunito(
                    TypeScale.heading,
                    weight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
              ),
              Flexible(
                child: Align(
                  alignment: Alignment.centerRight,
                  child: AppBadge(label: label, variant: badgeVariant),
                ),
              ),
            ],
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 10,
            children: [
              const AppIcon(
                AppIcon.calendar,
                size: 18,
                color: AppColors.primary,
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 4,
                  children: [
                    Text(
                      start == null ? 'Chưa có giờ' : _formatTime(start),
                      style: nunito(TypeScale.body, color: AppColors.body),
                    ),
                    Text(
                      '${sessionRoleLabel(session)} · $minutes phút',
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
          AppButton(
            label: action,
            variant: ButtonVariant.craft,
            minHeight: 50,
            borderRadius: 16,
            onPressed: () =>
                context.push('/learning-sessions/${session['id']}'),
          ),
        ],
      ),
    );
  }
}

String _formatTime(DateTime value) {
  final local = value.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(local.day)}/${two(local.month)}/${local.year}, '
      '${two(local.hour)}:${two(local.minute)}';
}
