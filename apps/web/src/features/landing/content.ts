import type { IconName } from "./icon";

export interface SkillItem {
  icon: IconName;
  title: string;
  tags: string;
  tone: "orange" | "sage" | "cream" | "peach" | "green" | "sand";
}

export const skills: readonly SkillItem[] = [
  {
    icon: "code",
    title: "Lập trình Web",
    tags: "React · Next.js · TypeScript",
    tone: "orange",
  },
  {
    icon: "data",
    title: "Backend & Hệ thống",
    tags: "Node.js · Python · SQL",
    tone: "sage",
  },
  {
    icon: "language",
    title: "Tiếng Anh",
    tags: "Giao tiếp 1:1 · IELTS · TOEIC",
    tone: "cream",
  },
  {
    icon: "globe",
    title: "Tiếng Nhật",
    tags: "Hội thoại · Luyện thi JLPT",
    tone: "peach",
  },
  {
    icon: "spark",
    title: "Data & AI",
    tags: "Python · Phân tích dữ liệu · ML",
    tone: "green",
  },
  {
    icon: "book",
    title: "Thiết kế & Kỹ năng mềm",
    tags: "UI/UX · Thuyết trình · Hàn & Trung",
    tone: "sand",
  },
];

export const steps: readonly { number: string; title: string; copy: string }[] =
  [
    {
      number: "01",
      title: "Chọn kỹ năng",
      copy: "Tìm người có kỹ năng bạn cần, hoặc chia sẻ điều bạn sẵn sàng hướng dẫn.",
    },
    {
      number: "02",
      title: "Chốt lộ trình & lịch học",
      copy: "Nhắn tin thống nhất số buổi, giờ học và mức Credit rõ ràng trước khi bắt đầu.",
    },
    {
      number: "03",
      title: "Học 1:1 & hoàn tất",
      copy: "Học trực tuyến trong phòng riêng, xác nhận hoàn thành và đánh giá nhau.",
    },
  ];

export const trustPillars: readonly {
  metric: string;
  title: string;
  copy: string;
}[] = [
  {
    metric: "1 CR = 1.000đ",
    title: "Quy đổi cố định",
    copy: "Credit được giữ an toàn và chỉ quyết toán một lần khi xong toàn bộ lộ trình.",
  },
  {
    metric: "96% / 4%",
    title: "Phí nền tảng công khai",
    copy: "Hoàn hoặc nhận 96% Credit khi hoàn tất. Phí duy trì 4% rõ ràng, không phí ẩn.",
  },
  {
    metric: "Xác minh 1:1",
    title: "Uy tín & quyền riêng tư",
    copy: "Chứng chỉ kỹ năng được duyệt riêng tư. Email và dữ liệu cá nhân luôn bảo mật.",
  },
];

export const faqs: readonly [string, string][] = [
  [
    "Một tài khoản có thể vừa học vừa hướng dẫn không?",
    "Có. Bạn linh hoạt đóng vai trò người học hoặc người hướng dẫn tùy theo từng thỏa thuận, không bị giới hạn vai trò cố định.",
  ],
  [
    "Trao đổi 2 chiều khác gì học 1 chiều?",
    "Ở trao đổi 2 chiều, hai bên dạy chéo kỹ năng cho nhau, cùng giữ Credit cam kết và nhận lại 96% khi hoàn tất. Ở học 1 chiều, chỉ người học giữ Credit và người hướng dẫn nhận 96% sau khi xong lộ trình.",
  ],
  [
    "Credit có được giữ an toàn trong lúc học không?",
    "Có. Credit chỉ tạm giữ sau khi cả hai xác nhận lịch học và chỉ quyết toán một lần duy nhất khi toàn bộ lộ trình hoàn tất, không có tranh chấp đang mở.",
  ],
  [
    "Mỗi buổi học kéo dài bao lâu và có đổi lịch được không?",
    "Mỗi buổi kéo dài 60–180 phút. Hai bên có thể thống nhất đổi lịch trước giờ bắt đầu tối thiểu 60 phút.",
  ],
];
