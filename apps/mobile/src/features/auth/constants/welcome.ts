import type { IconName } from "@/components/Icon";
import { colors } from "@/constants/theme";
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
  "Theo dõi số dư và lịch sử giao dịch",
  "Thống nhất điều kiện học trước khi bắt đầu",
  "Kiểm tra chi tiết Credit trong từng thỏa thuận",
];
export const welcomeFooter = [
  {
    title: "Sản phẩm",
    links: ["Khám phá kỹ năng", "Cách hoạt động", "Credit"],
  },
  {
    title: "Thông tin",
    links: ["Điều khoản", "Chính sách bảo mật"],
  },
];
