import '../product_shell/schema/notification_schema.dart';

const _titles = {
  'Session attendance recorded': 'Đã có kết quả điểm danh',
  'Absence explanation received': 'Có giải trình vắng học',
  'Absence explanation decided': 'Giải trình đã được phản hồi',
  'Session no-show finalized': 'Đã chốt kết quả vắng học',
  'Session completed': 'Buổi học đã hoàn thành',
  'Makeup session overdue': 'Đã quá hạn học bù',
  'New message': 'Tin nhắn mới',
  'Connection update': 'Cập nhật kết nối',
  'Learning request update': 'Cập nhật yêu cầu học',
  'Learning request not approved': 'Yêu cầu học chưa được duyệt',
  'Skill evidence revoked': 'Bằng chứng kỹ năng đã bị thu hồi',
  'Skill verification reviewed': 'Kết quả xác minh kỹ năng',
  'Learning path scheduled': 'Lộ trình học đã chốt lịch',
  'Learning path completed': 'Lộ trình học đã hoàn tất',
  'Session report opened': 'Báo cáo mới về buổi học',
  'Report case updated': 'Cập nhật báo cáo',
  'Material published': 'Tài liệu đã được xuất bản',
  'Material rejected': 'Tài liệu chưa được duyệt',
  'Material hidden': 'Tài liệu đã bị ẩn',
  'Material purchase refunded': 'Đã hoàn Credit mua tài liệu',
  'Material order refunded': 'Đơn mua tài liệu đã được hoàn Credit',
  'Material purchased': 'Mua tài liệu thành công',
  'Material sold': 'Tài liệu có lượt mua mới',
};

const _bodies = {
  'Attendance for your session has been determined. Check the session for next steps.':
      'Xem chi tiết buổi học để kiểm tra điểm danh và thao tác tiếp theo.',
  'Your partner explained their absence. Please accept or reject it.':
      'Đối tác đã giải trình việc vắng học. Hãy xem và phản hồi.',
  'Your partner responded to your absence explanation.':
      'Đối tác đã phản hồi giải trình vắng học của bạn.',
  'The no-show result for your session is now final.':
      'Kết quả vắng học của buổi học đã được chốt.',
  'The confirmation window ended and the session was completed.':
      'Đã hết thời hạn xác nhận. Hệ thống đã ghi nhận buổi học hoàn thành.',
  'No makeup time was agreed in time; staff will review the session.':
      'Chưa chốt được lịch học bù trước hạn. Nhân viên sẽ xem xét buổi học.',
  'A participant sent a message.': 'Một người tham gia đã gửi tin nhắn.',
  'A connection proposal has an update.':
      'Một đề nghị kết nối có cập nhật mới.',
  'Your skill verification decision is available in its history.':
      'Kết quả xác minh kỹ năng đã có trong lịch sử xác minh.',
  'Your learning path schedule is now locked.':
      'Lịch học của lộ trình đã được chốt.',
  'Your learning path has completed and settlement is recorded.':
      'Lộ trình học đã hoàn tất và quyết toán đã được ghi nhận.',
  'A report was opened for a session you participated in.':
      'Có báo cáo mới về một buổi học bạn đã tham gia.',
  'Your learning material is now live.':
      'Tài liệu học tập của bạn đã được xuất bản.',
  'Your learning material was rejected. See the review reason.':
      'Tài liệu chưa được duyệt. Hãy xem lý do xét duyệt.',
  'Your learning material was hidden by Staff.':
      'Tài liệu của bạn đã bị nhân viên ẩn.',
  'Your material access was revoked and the Credit refund was completed.':
      'Quyền truy cập tài liệu đã bị thu hồi và Credit đã được hoàn lại.',
  'A material purchase was refunded from your available Credit.':
      'Một đơn mua tài liệu đã được hoàn tiền từ số dư Credit khả dụng của bạn.',
  'Your purchased material is ready to download.':
      'Tài liệu đã mua đã sẵn sàng để tải xuống.',
  'A buyer purchased your learning material.':
      'Có người vừa mua tài liệu học tập của bạn.',
};

({String title, String body}) notificationCopy(
  NotificationRecord item, {
  String? sender,
}) {
  var body = _bodies[item.body] ?? item.body;
  if (item.type == 'learning-request.rejected') {
    body = item.body;
  } else if (item.type == 'LEARNING_REQUEST_REJECTED') {
    body = item.body.replaceFirst(
      RegExp(r'^Your learning request was rejected: '),
      'Yêu cầu học chưa được duyệt: ',
    );
  } else if (item.type == 'report.case.updated' &&
      RegExp(r'^The report case status is [A-Z_]+\.$').hasMatch(item.body)) {
    const statuses = {
      'OPEN': 'đang mở',
      'UNDER_REVIEW': 'đang xem xét',
      'NEED_MORE_INFO': 'cần bổ sung thông tin',
      'RESOLVED': 'đã giải quyết',
      'REJECTED': 'đã từ chối',
      'CLOSED': 'đã đóng',
    };
    final status = item.body.substring(26, item.body.length - 1);
    final label = statuses[status];
    body = label != null ? 'Trạng thái báo cáo: $label.' : item.body;
  }
  if (item.type == 'chat.message.delivered' && sender != null) {
    return (
      title: 'Tin nhắn mới từ $sender',
      body: '$sender đã gửi tin nhắn cho bạn.',
    );
  }
  return (title: _titles[item.title] ?? item.title, body: body);
}

String notificationTime(String value, [DateTime? now]) {
  final date = DateTime.tryParse(value)?.toLocal();
  if (date == null) return value;
  final clock = now ?? DateTime.now();
  final minutes = clock.difference(date).inMinutes.clamp(0, 1 << 30);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return '$minutes phút trước';
  if (minutes < 1440) return '${minutes ~/ 60} giờ trước';
  if (minutes < 10080) return '${minutes ~/ 1440} ngày trước';
  String two(int n) => n.toString().padLeft(2, '0');
  final year = date.year != clock.year ? '/${date.year}' : '';
  return '${date.day}/${date.month}$year, ${two(date.hour)}:${two(date.minute)}';
}
