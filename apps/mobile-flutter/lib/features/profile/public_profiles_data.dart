typedef DemoSkill = ({String id, String name, String level, bool verified});
typedef DemoReview = ({String name, String text, int stars});

class DemoPublicProfile {
  const DemoPublicProfile({
    required this.id,
    required this.name,
    this.headline,
    this.bio,
    this.reputation,
    this.rating,
    this.stats,
    this.skills = const [],
    this.reviews,
  });

  final String id;
  final String name;
  final String? headline;
  final String? bio;
  final int? reputation;
  final String? rating;
  final List<({String value, String label})>? stats;
  final List<DemoSkill> skills;
  final List<DemoReview>? reviews;
}

/// Public-only demo records. No contact details, private evidence or file URLs.
const demoPublicProfiles = [
  DemoPublicProfile(
    id: 'demo-viet-anh',
    name: 'Trần Việt Anh',
    headline: 'Senior Frontend Developer',
    bio:
        '5 năm kinh nghiệm Frontend tại các startup. Chuyên React, TypeScript, Next.js. Mình thích dạy theo dự án thực tế hơn lý thuyết suông.',
    reputation: 85,
    rating: '4.97 (24 đánh giá)',
    stats: [
      (value: '87', label: 'Buổi học'),
      (value: '23', label: 'Học viên'),
      (value: '96%', label: 'Hoàn thành'),
    ],
    skills: [
      (
        id: 'react',
        name: 'React & Next.js',
        level: 'Chuyên gia',
        verified: true,
      ),
      (id: 'typescript', name: 'TypeScript', level: 'Nâng cao', verified: true),
      (id: 'nodejs', name: 'Node.js', level: 'Nâng cao', verified: false),
    ],
    reviews: [
      (
        name: 'Nguyễn Bảo Long',
        text:
            'Anh Việt Anh dạy rất thực tế, sau khóa học mình có thể tự xây dựng ứng dụng React!',
        stars: 5,
      ),
      (
        name: 'Phạm Thị Hoa',
        text: 'Giải thích rõ ràng, kiên nhẫn với người mới. Rất recommend!',
        stars: 5,
      ),
    ],
  ),
  DemoPublicProfile(
    id: 'demo-hong-anh',
    name: 'Lê Hồng Anh',
    reputation: 85,
    bio:
        'Đang luyện thi IELTS, có thể hỗ trợ luyện Speaking & Writing Band 6.0+. Muốn học React để tự xây dựng một ứng dụng web hoàn chỉnh.',
    skills: [
      (
        id: 'ielts',
        name: 'Tiếng Anh / IELTS',
        level: 'Trung cấp',
        verified: false,
      ),
      (
        id: 'javascript',
        name: 'JavaScript cơ bản',
        level: 'Cơ bản',
        verified: false,
      ),
    ],
  ),
  DemoPublicProfile(id: 'demo-thi-mai', name: 'Vũ Thị Mai'),
  DemoPublicProfile(id: 'demo-quang-huy', name: 'Đỗ Quang Huy'),
  DemoPublicProfile(id: 'demo-thi-thu', name: 'Nguyễn Thị Thu'),
  DemoPublicProfile(id: 'demo-minh-ha', name: 'Nguyễn Minh Hà'),
  DemoPublicProfile(id: 'demo-minh-khang', name: 'Nguyễn Minh Khang'),
  DemoPublicProfile(id: 'demo-thu-ha', name: 'Phạm Thu Hà'),
];

DemoPublicProfile? findDemoProfile(String? id) =>
    demoPublicProfiles.where((p) => p.id == id).firstOrNull;
