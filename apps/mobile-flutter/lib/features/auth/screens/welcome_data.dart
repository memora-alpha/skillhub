import 'package:flutter/widgets.dart';

import '../../../components/app_icon.dart';
import '../../../core/theme/tokens.dart';

const welcomeStats = [
  ('12K+', 'Người dùng'),
  ('2.4K+', 'Kỹ năng chia sẻ'),
  ('94%', 'Hài lòng'),
];

const welcomeSteps = [
  (
    '01',
    AppIcon.users,
    'Tạo hồ sơ',
    'Chia sẻ kỹ năng bạn có và những điều bạn muốn học.',
  ),
  (
    '02',
    AppIcon.search,
    'Kết nối',
    'Tìm người phù hợp, gửi đề xuất và trao đổi qua chat.',
  ),
  (
    '03',
    AppIcon.zap,
    'Học & Chia sẻ',
    'Học 1:1 qua video call, hoàn thành lộ trình cùng nhau.',
  ),
];

const welcomeCategories = [
  ('Lập trình Web', 'React, Vue, Angular...', Palette.brand, AppIcon.book),
  (
    'Lập trình Backend',
    'Node.js, Python, Java...',
    Color(0xFFB8860B),
    AppIcon.settings,
  ),
  ('Tiếng Anh', 'IELTS, TOEIC, giao tiếp...', Palette.sage, AppIcon.message),
  ('Tiếng Nhật', 'N5 → N1, JLPT...', Color(0xFF6B3DB5), AppIcon.message),
  ('Tiếng Hàn', 'TOPIK I / II...', Color(0xFFC03070), AppIcon.message),
  ('Tiếng Trung', 'HSK, giao tiếp...', Color(0xFF2050B5), AppIcon.message),
  (
    'Data Science & AI',
    'Python, ML, TensorFlow...',
    Color(0xFF1A7030),
    AppIcon.zap,
  ),
  (
    'Tiếng Pháp / Tây Ban Nha',
    'DELF, DELE...',
    Color(0xFFB85A00),
    AppIcon.compass,
  ),
];

const welcomeBenefits = [
  '50 Credit miễn phí khi đăng ký',
  'Giữ Credit an toàn, chỉ thanh toán khi học xong',
  '96% Credit hoàn trả sau khi hoàn thành',
  'Minh bạch, không phí ẩn',
];

const welcomeBalance = '250 CR';
const welcomeTransactions = [
  ('Đã nạp', '+500 CR', Palette.sage),
  ('Đang giữ (lộ trình)', '-200 CR', Palette.warning),
  ('Thưởng đăng ký', '+50 CR', Palette.sage),
];

const welcomeReviews = [
  (
    'Nguyễn Bảo Long',
    'Học React · Dạy Tiếng Anh',
    '"Sau 2 tháng với mentor trên SkillHub, mình đã có việc làm frontend developer. Đổi buổi dạy IELTS lấy React — quá hời!"',
  ),
  (
    'Trần Thị Hương',
    'Dạy IELTS · Học Python',
    '"Mình dạy tiếng Anh đổi lấy khóa Python. Chỉ trong 3 tháng mình đã tự viết script xử lý dữ liệu cho công việc!"',
  ),
  (
    'Phạm Văn Đức',
    'Dạy Python · Học Tiếng Nhật',
    '"SkillHub cho phép mình vừa chia sẻ kỹ năng lập trình, vừa học tiếng Nhật để chuẩn bị du học. Credit system rất minh bạch."',
  ),
];

const welcomeFooter = [
  ('Sản phẩm', ['Khám phá kỹ năng', 'Cách hoạt động', 'Credit', 'Bảo mật']),
  (
    'Hỗ trợ',
    ['Trung tâm trợ giúp', 'Liên hệ', 'Điều khoản', 'Chính sách bảo mật'],
  ),
  ('Cộng đồng', ['Blog', 'Discord', 'Facebook', 'Instagram']),
];

const welcomeMentor = (
  name: 'Trần Việt Anh',
  title: 'React Developer',
  quote: '"Học xong dự án thật sự, không phải lý thuyết suông!"',
);

const welcomeSession = (
  title: 'Buổi học tiếp theo',
  schedule: 'React Hooks — T5, 20:00',
  status: 'Đã xác nhận',
);
