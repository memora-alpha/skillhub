import 'package:flutter/material.dart';

import '../../components/app_button.dart';
import '../../components/feature_page.dart';
import '../../components/misc.dart';

/// RN `ScheduleExistingFeedback` — whole-draft check against locked sessions.
class ScheduleExistingFeedback extends StatelessWidget {
  const ScheduleExistingFeedback({
    super.key,
    required this.hasSlots,
    required this.pending,
    required this.available,
    required this.limited,
    required this.checkedSessionCount,
    this.error,
    this.onRetry,
  });

  final bool hasSlots;
  final bool pending;
  final bool available;
  final bool limited;
  final int checkedSessionCount;
  final String? error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    if (!hasSlots) return const SizedBox.shrink();
    if (pending) {
      return const FormNotice(
        tone: NoticeTone.info,
        message: 'Đang kiểm tra lịch đã có…',
      );
    }
    if (error != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 8,
        children: [
          const FormNotice(
            tone: NoticeTone.error,
            message:
                'Không kiểm tra được Session đã có. Chưa thể gửi lịch; hãy tải lại phần kiểm tra. Lịch đang nhập vẫn được giữ.',
          ),
          if (onRetry != null)
            AppButton(
              label: 'Tải lại kiểm tra',
              variant: ButtonVariant.paper,
              size: ButtonSize.sm,
              onPressed: onRetry,
            ),
          FormNotice(tone: NoticeTone.error, message: error!),
        ],
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        if (limited)
          const FormNotice(
            tone: NoticeTone.error,
            message:
                'Đã tải tối đa 100 buổi; có thể còn lịch chưa được kiểm tra. Mở Sửa từng buổi để xem giờ bị trùng. Chưa thể gửi khi chưa đối chiếu đủ Session.',
          ),
        if (available && !limited)
          Copy(
            'Đã đối chiếu với $checkedSessionCount buổi học đã có.',
            muted: true,
          ),
      ],
    );
  }
}
