import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../components/app_icon.dart';
import '../../components/dialogs.dart';
import '../../core/theme/tokens.dart';

/// Shared by the bottom tabs, header actions and feature shortcuts.
const appRoutes = {
  'Trang chủ': '/home',
  'Khám phá': '/discover',
  'Khám phá kỹ năng': '/search',
  'Tìm kỹ năng': '/search',
  'Yêu cầu học phù hợp': '/discover',
  'Lịch học': '/calendar',
  'Tin nhắn': '/messages',
  'Hồ sơ': '/profile',
  'Cài đặt': '/account-settings',
  'Thông báo': '/notifications',
  'Tìm kiếm': '/search',
  'Ví Credit': '/wallet',
  'Tài liệu của tôi': '/materials/mine',
  'Tài liệu học tập': '/materials',
  'Trung tâm trợ giúp': '/help',
  'Kỹ năng': '/skills',
  'Thêm kỹ năng chia sẻ': '/skills/new',
  'Xác minh kỹ năng': '/skills',
  'Thành tích': '/achievements',
  'Tiến trình huy hiệu': '/achievements',
  'Đánh giá': '/reviews',
  'Uy tín': '/reputation',
  'Báo cáo của tôi': '/reports',
  'Đăng yêu cầu học': '/requests/new',
  'Tạo yêu cầu học đầu tiên': '/requests/new',
  'Yêu cầu học của tôi': '/requests',
  'Lộ trình đang học': '/paths/path-active',
  'Vào học': '/learning-sessions/active-react-1/room',
  'Lộ trình của tôi': '/paths',
  'Bộ giao diện mobile': '/ui',
};

const appTabs = [
  (path: '/home', label: 'Trang chủ', icon: AppIcon.home),
  (path: '/discover', label: 'Khám phá', icon: AppIcon.compass),
  (path: '/calendar', label: 'Lịch học', icon: AppIcon.calendar),
  (path: '/messages', label: 'Tin nhắn', icon: AppIcon.message),
  (path: '/profile', label: 'Hồ sơ', icon: AppIcon.user),
];

const accountItems = [
  (label: 'Hồ sơ', icon: AppIcon.user),
  (label: 'Ví Credit', icon: AppIcon.wallet),
  (label: 'Tài liệu của tôi', icon: AppIcon.book),
  (label: 'Cài đặt', icon: AppIcon.settings),
  (label: 'Trung tâm trợ giúp', icon: AppIcon.help),
  (label: 'Bộ giao diện mobile', icon: AppIcon.compass),
];

const demoNotifications = [
  'Buổi học React với Trần Việt Anh sắp diễn ra.',
  'Bạn có 2 tin nhắn mới từ Trần Việt Anh.',
  'Có yêu cầu học phù hợp với kỹ năng của bạn.',
];

bool isTabPath(String path) => appTabs.any((tab) => tab.path == path);

/// Switches tabs with `go` and stacks every other screen with `push`.
void navigateTo(BuildContext context, String path) {
  if (isTabPath(Uri.parse(path).path)) {
    context.go(path);
  } else {
    context.push(path);
  }
}

/// Opens a route for known labels, or a "coming next" notice otherwise.
void openAppAction(
  BuildContext context,
  String label, {
  String? Function(String label)? noticeBody,
}) {
  final route = appRoutes[label];
  if (route != null) {
    navigateTo(context, route);
    return;
  }
  final body = noticeBody?.call(label);
  showInfoModal(
    context,
    title: label,
    content: Text(
      body ??
          'Màn ${label.toLowerCase()} sẽ được triển khai ở bước tiếp theo. '
              'Hiện tại bạn đang xem giao diện với dữ liệu mẫu.',
      style: nunito(TypeScale.body, color: AppColors.body),
    ),
  );
}
