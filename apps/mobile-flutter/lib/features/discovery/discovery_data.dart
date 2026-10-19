import 'dart:ui';

import '../../core/theme/tokens.dart';

abstract final class DiscoveryColors {
  static const background = Chrome.background;
  static const surface = Chrome.surface;
  static const ink = Chrome.ink;
  static const body = Color(0xFF6E6B66);
  static const muted = Color(0xFF97928A);
  static const border = Chrome.border;
  static const orange = Chrome.accent;
  static const orangeDark = Color(0xFFD95120);
  static const orangeSoft = Color(0xFFFFF4EE);
  static const green = Color(0xFF27977B);
  static const greenSoft = Color(0xFFEAF7F0);
  static const sharing = Color(0xFFF5FCF8);
  static const purple = Color(0xFF9864CB);
  static const purpleSoft = Color(0xFFF3EAFB);
  static const tag = Color(0xFFF6F7F8);
}

const requestFilters = ['Tất cả', 'Lập trình', 'Ngoại ngữ'];

class LearningRequest {
  const LearningRequest({
    required this.id,
    required this.title,
    required this.user,
    required this.userId,
    required this.budget,
    required this.tags,
    required this.sessions,
    required this.created,
    required this.category,
  });

  final String id;
  final String title;
  final String user;
  final String userId;
  final String budget;
  final List<String> tags;
  final int sessions;
  final String created;
  final String category;

  int get budgetCredit => int.tryParse(budget.split(' ').first) ?? 0;
}

/// Sample requests from the Figma Make export. No remote data source.
const learningRequests = [
  LearningRequest(
    id: 'react',
    title: 'Muốn học React từ cơ bản đến nâng cao',
    user: 'Lê Hồng Anh',
    userId: 'demo-hong-anh',
    budget: '50 CR/lộ trình',
    tags: ['React', 'Frontend'],
    sessions: 6,
    created: '2 giờ trước',
    category: 'Lập trình',
  ),
  LearningRequest(
    id: 'ielts',
    title: 'Cần người hướng dẫn IELTS từ 6.0 lên 7.0',
    user: 'Vũ Thị Mai',
    userId: 'demo-thi-mai',
    budget: '70 CR/lộ trình',
    tags: ['IELTS', 'Tiếng Anh'],
    sessions: 8,
    created: '5 giờ trước',
    category: 'Ngoại ngữ',
  ),
  LearningRequest(
    id: 'python',
    title: 'Học Python để làm Data Science, cần mentor thực chiến',
    user: 'Đỗ Quang Huy',
    userId: 'demo-quang-huy',
    budget: '60 CR/lộ trình',
    tags: ['Python', 'Data Science'],
    sessions: 6,
    created: '1 ngày trước',
    category: 'Lập trình',
  ),
  LearningRequest(
    id: 'japanese',
    title: 'Học tiếng Nhật từ N5 lên N3, cần người luyện hội thoại',
    user: 'Nguyễn Thị Thu',
    userId: 'demo-thi-thu',
    budget: '65 CR/lộ trình',
    tags: ['Tiếng Nhật', 'JLPT'],
    sessions: 8,
    created: '2 ngày trước',
    category: 'Ngoại ngữ',
  ),
];

LearningRequest? findLearningRequest(String? id) {
  for (final item in learningRequests) {
    if (item.id == id) return item;
  }
  return null;
}

class RequestDetailContent {
  const RequestDetailContent({
    required this.hashtags,
    required this.duration,
    required this.learning,
    required this.learningTags,
    required this.sharing,
    required this.sharingTags,
    required this.schedule,
    required this.scheduleNote,
    required this.reputation,
    required this.memberSince,
  });

  final List<String> hashtags;
  final String duration;
  final String learning;
  final List<String> learningTags;
  final String sharing;
  final List<String> sharingTags;
  final List<({String day, List<String> slots})> schedule;
  final String scheduleNote;
  final int reputation;
  final String memberSince;
}

/// The export supplies a complete detail frame only for the React request.
const requestDetails = {
  'react': RequestDetailContent(
    hashtags: ['#React', '#Frontend', '#JavaScript', '#Hooks', '#StateManagement'],
    duration: '60–90 phút/buổi',
    learning:
        'React từ cơ bản đến nâng cao — hiểu rõ hooks (useState, useEffect, useContext), state management với Redux Toolkit, và cách tổ chức project thực tế. Mục tiêu cuối là tự xây được một ứng dụng web hoàn chỉnh.',
    learningTags: ['React Hooks', 'Redux', 'Component Design', 'API Integration'],
    sharing:
        'Tiếng Anh IELTS — mình đang học luyện thi, có thể hỗ trợ luyện Speaking & Writing Band 6.0+. Hoặc JavaScript cơ bản nếu người dạy React chưa quen JS.',
    sharingTags: [
      'Tiếng Anh IELTS',
      'IELTS Speaking',
      'IELTS Writing',
      'JavaScript cơ bản',
    ],
    schedule: [
      (day: 'Thứ 5', slots: ['19:00 – 21:00']),
      (day: 'Thứ 7', slots: ['08:00 – 10:00', '19:00 – 21:00']),
      (day: 'Chủ nhật', slots: ['08:00 – 11:00']),
    ],
    scheduleNote:
        'Ưu tiên học online qua video call · Có thể điều chỉnh lịch nếu cần',
    reputation: 85,
    memberSince: 'Thành viên 3 tháng',
  ),
};
