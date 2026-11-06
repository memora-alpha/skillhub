import 'live_sessions.dart';

enum SessionPresentationVariant { success, warning, sage, def }

class SessionPresentation {
  const SessionPresentation({
    required this.label,
    required this.variant,
    required this.description,
  });

  final String label;
  final SessionPresentationVariant variant;
  final String description;
}

/// RN `sessionPresentation` — status badge copy for session cards.
SessionPresentation sessionPresentation(
  Map<String, dynamic> session, [
  DateTime? now,
]) {
  final clock = now ?? DateTime.now();
  final status = sessionStatusOf(session);
  final start = sessionInstant(session['startAt']);
  final end = sessionInstant(session['endAt']);
  final endMs = end?.millisecondsSinceEpoch ?? 0;
  final startMs = start?.millisecondsSinceEpoch ?? 0;
  final nowMs = clock.millisecondsSinceEpoch;

  if (status == 'NO_SHOW') {
    return const SessionPresentation(
      label: 'Có người vắng học',
      variant: SessionPresentationVariant.warning,
      description: 'Xem kết quả điểm danh, giải trình vắng học và xử lý học bù.',
    );
  }
  if (status == 'MAKEUP_REQUIRED') {
    return const SessionPresentation(
      label: 'Cần học bù',
      variant: SessionPresentationVariant.warning,
      description: 'Hai bên cần thống nhất và xác nhận lịch học bù trước hạn.',
    );
  }
  if (status == 'COMPLETED') {
    return const SessionPresentation(
      label: 'Đã hoàn thành',
      variant: SessionPresentationVariant.success,
      description: 'Hệ thống đã ghi nhận buổi học hoàn thành.',
    );
  }
  if (status == 'CANCELLED') {
    return const SessionPresentation(
      label: 'Đã hủy',
      variant: SessionPresentationVariant.def,
      description: 'Buổi học đã hủy và không còn diễn ra theo lịch này.',
    );
  }
  if (status == 'DISPUTED') {
    return const SessionPresentation(
      label: 'Đang tranh chấp',
      variant: SessionPresentationVariant.warning,
      description: 'Chưa thể xác nhận hoàn thành khi buổi học đang tranh chấp.',
    );
  }
  if (status == 'AWAITING_CONFIRMATION' ||
      (status == 'ONGOING' && nowMs >= endMs && end != null)) {
    return const SessionPresentation(
      label: 'Đã kết thúc · chờ xác nhận',
      variant: SessionPresentationVariant.warning,
      description:
          'Buổi học đã kết thúc; cần xác nhận hoàn thành của cả hai bên.',
    );
  }
  if (status == 'ONGOING') {
    return const SessionPresentation(
      label: 'Đang học',
      variant: SessionPresentationVariant.sage,
      description: 'Buổi học đang diễn ra.',
    );
  }
  if (end != null && nowMs >= endMs) {
    return const SessionPresentation(
      label: 'Đã hết giờ học',
      variant: SessionPresentationVariant.warning,
      description:
          'Đã hết giờ vào phòng. Tải lại để kiểm tra trạng thái buổi học.',
    );
  }
  if (start != null && nowMs >= startMs) {
    return const SessionPresentation(
      label: 'Chờ bắt đầu',
      variant: SessionPresentationVariant.warning,
      description:
          'Đã đến giờ học. Vào phòng để bắt đầu; bạn có thể vào lại nếu mất kết nối trong giờ học.',
    );
  }
  return SessionPresentation(
    label: status == 'READY' ? 'Sắp bắt đầu' : 'Sắp tới',
    variant: SessionPresentationVariant.sage,
    description:
        'Lịch học đã được chốt. Đổi lịch cần cả hai xác nhận trước giờ bắt đầu ít nhất 60 phút.',
  );
}
