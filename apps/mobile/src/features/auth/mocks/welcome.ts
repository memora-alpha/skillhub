import type { IconName } from "@/components/Icon";
import { colors } from "@/constants/theme";

export const welcomeStats = [
  { value: "12K+", label: "Người dùng" },
  { value: "2.4K+", label: "Kỹ năng chia sẻ" },
  { value: "94%", label: "Hài lòng" },
];
export const welcomeSteps: {
  step: string;
  icon: IconName;
  title: string;
  description: string;
}[] = [
  {
    step: "01",
    icon: "users",
    title: "Tạo hồ sơ",
    description: "Chia sẻ kỹ năng bạn có và những điều bạn muốn học.",
  },
  {
    step: "02",
    icon: "search",
    title: "Kết nối",
    description: "Tìm người phù hợp, gửi đề xuất và trao đổi qua chat.",
  },
  {
    step: "03",
    icon: "zap",
    title: "Học & Chia sẻ",
    description: "Học 1:1 qua video call, hoàn thành Learning Path cùng nhau.",
  },
];
export const welcomeCategories: {
  title: string;
  description: string;
  color: string;
  icon: IconName;
}[] = [
  {
    title: "Lập trình Web",
    description: "React, Vue, Angular...",
    color: colors.brand,
    icon: "book",
  },
  {
    title: "Lập trình Backend",
    description: "Node.js, Python, Java...",
    color: "#B8860B",
    icon: "settings",
  },
  {
    title: "Tiếng Anh",
    description: "IELTS, TOEIC, giao tiếp...",
    color: colors.sage,
    icon: "message",
  },
  {
    title: "Tiếng Nhật",
    description: "N5 → N1, JLPT...",
    color: "#6B3DB5",
    icon: "message",
  },
  {
    title: "Tiếng Hàn",
    description: "TOPIK I / II...",
    color: "#C03070",
    icon: "message",
  },
  {
    title: "Tiếng Trung",
    description: "HSK, giao tiếp...",
    color: "#2050B5",
    icon: "message",
  },
  {
    title: "Data Science & AI",
    description: "Python, ML, TensorFlow...",
    color: "#1A7030",
    icon: "zap",
  },
  {
    title: "Tiếng Pháp / Tây Ban Nha",
    description: "DELF, DELE...",
    color: "#B85A00",
    icon: "compass",
  },
];
export const welcomeBenefits = [
  "50 Credit miễn phí khi đăng ký",
  "Giữ Credit an toàn, chỉ thanh toán khi học xong",
  "96% Credit hoàn trả sau khi hoàn thành",
  "Minh bạch, không phí ẩn",
];
export const welcomeWallet = {
  balance: "250 CR",
  transactions: [
    { label: "Đã nạp", amount: "+500 CR", color: colors.sage },
    {
      label: "Đang giữ (Learning Path)",
      amount: "-200 CR",
      color: colors.warning,
    },
    { label: "Thưởng đăng ký", amount: "+50 CR", color: colors.sage },
  ],
};
export const welcomeReviews = [
  {
    name: "Nguyễn Bảo Long",
    role: "Học React · Dạy Tiếng Anh",
    text: '"Sau 2 tháng với mentor trên SkillHub, mình đã có việc làm frontend developer. Đổi buổi dạy IELTS lấy React — quá hời!"',
  },
  {
    name: "Trần Thị Hương",
    role: "Dạy IELTS · Học Python",
    text: '"Mình dạy tiếng Anh đổi lấy khóa Python. Chỉ trong 3 tháng mình đã tự viết script xử lý dữ liệu cho công việc!"',
  },
  {
    name: "Phạm Văn Đức",
    role: "Dạy Python · Học Tiếng Nhật",
    text: '"SkillHub cho phép mình vừa chia sẻ kỹ năng lập trình, vừa học tiếng Nhật để chuẩn bị du học. Credit system rất minh bạch."',
  },
];
export const welcomeFooter = [
  {
    title: "Sản phẩm",
    links: ["Khám phá kỹ năng", "Cách hoạt động", "Credit", "Bảo mật"],
  },
  {
    title: "Hỗ trợ",
    links: [
      "Trung tâm trợ giúp",
      "Liên hệ",
      "Điều khoản",
      "Chính sách bảo mật",
    ],
  },
  { title: "Cộng đồng", links: ["Blog", "Discord", "Facebook", "Instagram"] },
];
export const welcomeMentor = {
  name: "Trần Việt Anh",
  title: "React Developer",
  quote: '"Học xong dự án thật sự, không phải lý thuyết suông!"',
};
export const welcomeSession = {
  title: "Buổi học tiếp theo",
  schedule: "React Hooks — T5, 20:00",
  status: "Đã xác nhận",
};
