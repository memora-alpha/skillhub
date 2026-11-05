import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_icon.dart';
import '../../components/tappable.dart';
import '../../core/theme/tokens.dart';
import '../sessions/live_sessions.dart';
import '../sessions/session_presentation.dart';

/// RN `CalendarSessionCard` visual clone.
class CalendarSessionCard extends StatelessWidget {
  const CalendarSessionCard({
    super.key,
    required this.session,
    this.highlight = false,
  });

  final Map<String, dynamic> session;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final presentation = sessionPresentation(session);
    final label = switch (presentation.label) {
      _ when highlight &&
              (presentation.label == 'Sắp tới' ||
                  presentation.label == 'Sắp bắt đầu') =>
        'Sắp vào học',
      'Đã kết thúc · chờ xác nhận' => 'Chờ xác nhận',
      _ => presentation.label,
    };
    final warning =
        highlight || presentation.variant == SessionPresentationVariant.warning;
    final cancelled = sessionStatusOf(session) == 'CANCELLED';
    final start = sessionInstant(session['startAt']);
    final minutes = sessionMinutes(session);
    const actionLabel = 'Mở buổi học';

    final badgeBg = cancelled
        ? AppColors.surfaceInset
        : warning
        ? const Color(0xFFFFF2EC)
        : const Color(0xFFEAF7F0);
    final badgeFg = cancelled
        ? Chrome.muted
        : warning
        ? const Color(0xFFD95120)
        : const Color(0xFF27977B);
    final dot = cancelled
        ? Chrome.muted
        : warning
        ? Chrome.accent
        : const Color(0xFF27977B);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: highlight ? const Color(0xFFFFF8F4) : Chrome.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: highlight ? Chrome.accent : Chrome.border,
          width: highlight ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: highlight
                ? const Color(0x33D9532F)
                : const Color(0x0F5A3C28),
            blurRadius: highlight ? 24 : 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 16,
        children: [
          Row(
            spacing: 10,
            children: [
              Text(
                'Buổi học',
                style: nunito(
                  TypeScale.heading,
                  weight: FontWeight.w700,
                  color: Chrome.ink,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: badgeBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  spacing: 6,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: dot,
                        shape: BoxShape.circle,
                      ),
                    ),
                    Flexible(
                      child: Text(
                        label,
                        style: nunito(
                          TypeScale.caption,
                          weight: FontWeight.w600,
                          color: badgeFg,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 10,
            children: [
              Row(
                spacing: 10,
                children: [
                  const AppIcon(AppIcon.users, size: 18, color: Color(0xFF97928A)),
                  Expanded(
                    child: Text(
                      '${sessionRoleLabel(session)} · $minutes phút',
                      style: nunito(
                        TypeScale.secondary,
                        color: Chrome.ink,
                      ),
                    ),
                  ),
                ],
              ),
              Row(
                spacing: 10,
                children: [
                  const AppIcon(AppIcon.clock, size: 18, color: Color(0xFF97928A)),
                  Expanded(
                    child: Text(
                      start == null
                          ? 'Chưa có giờ'
                          : _formatTime(start),
                      style: nunito(
                        TypeScale.secondary,
                        color: const Color(0xFF534D47),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Tappable(
              semanticLabel: actionLabel,
              onTap: () =>
                  context.push('/learning-sessions/${session['id']}'),
              child: Container(
                constraints: const BoxConstraints(minHeight: 50),
                padding: const EdgeInsets.all(12),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: const LinearGradient(
                    colors: [Chrome.accent, Color(0xFFD95120)],
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x40D9532F),
                      blurRadius: 14,
                      offset: Offset(0, 4),
                    ),
                  ],
                ),
                child: Text(
                  actionLabel,
                  style: nunito(
                    TypeScale.body,
                    weight: FontWeight.w600,
                    color: Chrome.surface,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _formatTime(DateTime value) {
  final local = value.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  const months = [
    'thg 1',
    'thg 2',
    'thg 3',
    'thg 4',
    'thg 5',
    'thg 6',
    'thg 7',
    'thg 8',
    'thg 9',
    'thg 10',
    'thg 11',
    'thg 12',
  ];
  return '${local.day} ${months[local.month - 1]}, ${local.year}, '
      '${two(local.hour)}:${two(local.minute)}';
}
