import type { IconName } from "./icon";

export const skills: {
  icon: IconName;
  title: string;
  copy: string;
  tone: string;
}[] = [
  {
    icon: "code",
    title: "Lập trình Web",
    copy: "React · Next.js · TypeScript",
    tone: "orange",
  },
  {
    icon: "data",
    title: "Backend & Hệ thống",
    copy: "Node.js · Python · Java · SQL",
    tone: "sage",
  },
  {
    icon: "language",
    title: "Tiếng Anh",
    copy: "Giao tiếp 1:1 · IELTS · TOEIC",
    tone: "cream",
  },
  {
    icon: "globe",
    title: "Tiếng Nhật",
    copy: "Hội thoại · Luyện thi JLPT",
    tone: "peach",
  },
  {
    icon: "spark",
    title: "Data & AI",
    copy: "Python · Phân tích dữ liệu · ML",
    tone: "green",
  },
  {
    icon: "book",
    title: "Ngoại ngữ & Kỹ năng mềm",
    copy: "Hàn · Trung · Thiết kế · Thuyết trình",
    tone: "sand",
  },
];

export const steps: readonly [string, string, string?][] = [
  [
    "Tạo hồ sơ & kỹ năng",
    "Đăng ký xác minh OTP, khởi điểm 50 điểm Uy tín. Khai báo kỹ năng chia sẻ và nộp chứng chỉ để nhân sự xác minh.",
  ],
  [
    "Đăng nhu cầu hoặc tìm theo kỹ năng",
    "Đăng bài tìm người hướng dẫn (lọc tự động/duyệt nhanh) hoặc chủ động tìm người chia sẻ theo kỹ năng và gửi đề nghị.",
  ],
  [
    "Chat & chốt 2 chiều minh bạch",
    "Chấp nhận đề nghị sẽ mở Chat. Hai bên chọn Trao đổi 2 chiều hoặc Học 1 chiều, lập lộ trình và xác nhận cùng phiên bản.",
    "Với trao đổi 2 chiều, A lập kế hoạch A→B cho B xác nhận và B lập kế hoạch B→A cho A xác nhận trước khi xếp lịch.",
  ],
  [
    "Xếp lịch, giữ Credit & học 1:1",
    "Lịch gắn từng kế hoạch (60–180 phút/buổi), cả hai xác nhận mới tạm giữ Credit và mở phòng LiveKit 1:1. Đổi lịch cần chốt trước 60 phút.",
  ],
  [
    "Hoàn thành, quyết toán & đánh giá",
    "Cả hai xác nhận sau mỗi buổi học. Hoàn tất toàn bộ lộ trình mới quyết toán 96%/4%, cập nhật kỹ năng đã học và mở đánh giá 1–5 sao.",
  ],
];

export const faqs: readonly [string, string][] = [
  [
    "Tôi có thể vừa học vừa hướng dẫn người khác không?",
    "Có. SkillHub không cố định tài khoản thành giáo viên hay học viên. Vai trò người học và người hướng dẫn được xác định linh hoạt theo từng thỏa thuận học tập.",
  ],
  [
    "Trao đổi hai chiều (TWO_WAY) khác gì học một chiều (ONE_WAY)?",
    "Ở trao đổi hai chiều, mỗi bên lập một kế hoạch giảng dạy cho chiều mình phụ trách (A→B và B→A), cùng giữ cam kết tối thiểu 20 Credit/người và nhận lại 96% của chính mình khi hoàn tất. Ở học một chiều, người hướng dẫn lập 1 kế hoạch, hai bên thương lượng tổng Credit (>0), chỉ người học tạm giữ và người dạy nhận 96% khi xong toàn bộ lộ trình.",
  ],
  [
    "Credit có quyết toán theo từng buổi học không?",
    "Không. Xác nhận hoàn thành từng buổi chỉ cập nhật tiến độ (N/M buổi). Hệ thống chỉ quyết toán một lần duy nhất sau khi toàn bộ buổi học của thỏa thuận hoàn tất và không có tranh chấp đang giữ Credit.",
  ],
  [
    "Một buổi học kéo dài bao lâu và có thể đổi lịch không?",
    "Mỗi buổi học kéo dài từ 60 đến 180 phút. Khi cần đổi lịch buổi đã chốt, cả hai bên phải xác nhận lịch mới trước giờ bắt đầu ít nhất 60 phút; nếu không đủ hai xác nhận đúng hạn, lịch cũ vẫn giữ nguyên hiệu lực.",
  ],
  [
    "Credit quy đổi thế nào và có rút ra tiền mặt được không?",
    "Tỷ lệ nạp chuẩn là 1.000 VNĐ = 1 Credit qua cổng thanh toán được xác minh. SkillHub hiện không hỗ trợ rút Credit ra tiền mặt; Credit được dùng cho trao đổi kỹ năng, học một chiều và tài liệu số trong nền tảng.",
  ],
  [
    "Điểm uy tín (Reputation) hoạt động ra sao?",
    "Mọi tài khoản kích hoạt bắt đầu với 50/100 điểm uy tín. Điểm thay đổi minh bạch theo hoàn thành lộ trình, đánh giá 1–5 sao và vi phạm đã xác nhận. Nếu điểm xuống dưới 40, hệ thống cung cấp Nhiệm vụ phục hồi uy tín rõ ràng.",
  ],
  [
    "Tài liệu số trên SkillHub có miễn phí không?",
    "Có cả tài liệu miễn phí (0 Credit) và trả phí bằng Credit. Mọi tệp đều qua kiểm tra an toàn trước khi xuất bản; tài liệu trả phí chỉ mở quyền tải sau khi bạn mua hợp lệ bằng Credit khả dụng.",
  ],
];
