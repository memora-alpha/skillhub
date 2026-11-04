import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';

/// Left rail marker + dashed connector matching RN `ScheduleTimelineItem`.
class ScheduleTimelineItem extends StatelessWidget {
  const ScheduleTimelineItem({
    super.key,
    required this.last,
    required this.child,
  });

  final bool last;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 10,
        children: [
          SizedBox(
            width: 18,
            child: Stack(
              alignment: Alignment.topCenter,
              children: [
                if (!last)
                  const Positioned(
                    top: 17,
                    bottom: -27,
                    width: 2,
                    child: CustomPaint(
                      painter: ScheduleDashedLinePainter(
                        color: Color(0x80BA4E36),
                      ),
                    ),
                  ),
                Container(
                  margin: const EdgeInsets.only(top: 10),
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.primarySoft, width: 3),
                  ),
                ),
              ],
            ),
          ),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class ScheduleDashedLinePainter extends CustomPainter {
  const ScheduleDashedLinePainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    const dash = 3.0;
    const gap = 5.0;
    var y = 0.0;
    while (y < size.height) {
      final end = (y + dash).clamp(0.0, size.height);
      canvas.drawLine(Offset(1, y), Offset(1, end), paint);
      y += dash + gap;
    }
  }

  @override
  bool shouldRepaint(covariant ScheduleDashedLinePainter oldDelegate) =>
      oldDelegate.color != color;
}
