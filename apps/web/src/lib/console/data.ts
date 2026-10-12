// Mock data for the staff/admin portal. Shapes mirror services/api Prisma enums;
// swap these exports for API calls once the web app has auth.

export type RoleCode = "USER" | "STAFF" | "ADMIN";
export type AccountStatus =
  "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "LOCKED" | "DEACTIVATED";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  roles: RoleCode[];
  status: AccountStatus;
  reputation: number;
  credit: number;
  joinedAt: string;
  lastActiveAt: string;
  skills: number;
  openReports: number;
};

export const USERS: AdminUser[] = [
  {
    id: "usr_01",
    name: "Nguyễn Minh Anh",
    email: "minhanh@example.com",
    roles: ["USER"],
    status: "ACTIVE",
    reputation: 72,
    credit: 340,
    joinedAt: "2026-03-14T08:00:00Z",
    lastActiveAt: "2026-10-12T02:10:00Z",
    skills: 4,
    openReports: 0,
  },
  {
    id: "usr_02",
    name: "Trần Quốc Bảo",
    email: "quocbao@skillhub.test",
    roles: ["USER", "STAFF"],
    status: "ACTIVE",
    reputation: 61,
    credit: 120,
    joinedAt: "2026-02-02T08:00:00Z",
    lastActiveAt: "2026-10-12T01:40:00Z",
    skills: 2,
    openReports: 0,
  },
  {
    id: "usr_03",
    name: "Lê Thu Hà",
    email: "thuha@example.com",
    roles: ["USER"],
    status: "LOCKED",
    reputation: 18,
    credit: 0,
    joinedAt: "2026-05-21T08:00:00Z",
    lastActiveAt: "2026-10-03T11:00:00Z",
    skills: 1,
    openReports: 3,
  },
  {
    id: "usr_04",
    name: "Phạm Gia Huy",
    email: "giahuy@example.com",
    roles: ["USER"],
    status: "ACTIVE",
    reputation: 88,
    credit: 1250,
    joinedAt: "2026-01-09T08:00:00Z",
    lastActiveAt: "2026-10-11T20:30:00Z",
    skills: 7,
    openReports: 0,
  },
  {
    id: "usr_05",
    name: "Võ Khánh Linh",
    email: "khanhlinh@example.com",
    roles: ["USER"],
    status: "ACTIVE",
    reputation: 55,
    credit: 80,
    joinedAt: "2026-07-30T08:00:00Z",
    lastActiveAt: "2026-10-12T00:05:00Z",
    skills: 3,
    openReports: 1,
  },
  {
    id: "usr_06",
    name: "Đặng Hoàng Nam",
    email: "hoangnam@skillhub.test",
    roles: ["USER", "STAFF", "ADMIN"],
    status: "ACTIVE",
    reputation: 90,
    credit: 500,
    joinedAt: "2025-12-01T08:00:00Z",
    lastActiveAt: "2026-10-12T03:00:00Z",
    skills: 5,
    openReports: 0,
  },
  {
    id: "usr_07",
    name: "Bùi Ngọc Mai",
    email: "ngocmai@example.com",
    roles: ["USER"],
    status: "PENDING_VERIFICATION",
    reputation: 50,
    credit: 0,
    joinedAt: "2026-10-11T14:00:00Z",
    lastActiveAt: "2026-10-11T14:05:00Z",
    skills: 0,
    openReports: 0,
  },
  {
    id: "usr_08",
    name: "Hoàng Tuấn Kiệt",
    email: "tuankiet@example.com",
    roles: ["USER"],
    status: "SUSPENDED",
    reputation: 34,
    credit: 45,
    joinedAt: "2026-04-18T08:00:00Z",
    lastActiveAt: "2026-09-28T09:00:00Z",
    skills: 2,
    openReports: 2,
  },
];

export const userName = (id: string) =>
  USERS.find((u) => u.id === id)?.name ?? id;

export type CatalogStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type SkillItem = {
  id: string;
  name: string;
  category: string;
  status: CatalogStatus;
  /** Rows (requests, sharing skills, evidence) referencing this skill — blocks hard delete. */
  refs: number;
  verifiedUsers: number;
};

export const SKILLS: SkillItem[] = [
  {
    id: "sk_01",
    name: "Tiếng Anh giao tiếp",
    category: "Ngôn ngữ",
    status: "ACTIVE",
    refs: 128,
    verifiedUsers: 41,
  },
  {
    id: "sk_02",
    name: "Lập trình Python",
    category: "Công nghệ",
    status: "ACTIVE",
    refs: 96,
    verifiedUsers: 33,
  },
  {
    id: "sk_03",
    name: "Thiết kế UI/UX",
    category: "Thiết kế",
    status: "ACTIVE",
    refs: 74,
    verifiedUsers: 22,
  },
  {
    id: "sk_04",
    name: "Guitar cơ bản",
    category: "Âm nhạc",
    status: "ACTIVE",
    refs: 39,
    verifiedUsers: 9,
  },
  {
    id: "sk_05",
    name: "Nhiếp ảnh",
    category: "Nghệ thuật",
    status: "ACTIVE",
    refs: 31,
    verifiedUsers: 12,
  },
  {
    id: "sk_06",
    name: "Excel nâng cao",
    category: "Văn phòng",
    status: "ACTIVE",
    refs: 58,
    verifiedUsers: 18,
  },
  {
    id: "sk_07",
    name: "Tiếng Nhật N5",
    category: "Ngôn ngữ",
    status: "INACTIVE",
    refs: 12,
    verifiedUsers: 3,
  },
  {
    id: "sk_08",
    name: "Kỹ năng thuyết trình",
    category: "Kỹ năng mềm",
    status: "ACTIVE",
    refs: 47,
    verifiedUsers: 15,
  },
  {
    id: "sk_09",
    name: "Cờ vua",
    category: "Giải trí",
    status: "ARCHIVED",
    refs: 0,
    verifiedUsers: 0,
  },
  {
    id: "sk_10",
    name: "Vẽ minh họa",
    category: "Nghệ thuật",
    status: "ACTIVE",
    refs: 26,
    verifiedUsers: 7,
  },
];

export const CATEGORIES = [...new Set(SKILLS.map((s) => s.category))];

// ---------- Staff queues ----------

export type EvidenceFile = { name: string; mime: string; size: number };
export type Evidence = {
  id: string;
  userId: string;
  skill: string;
  level: string;
  submittedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note: string;
  files: EvidenceFile[];
  rejectReason?: string;
};

export const EVIDENCE: Evidence[] = [
  {
    id: "ev_101",
    userId: "usr_01",
    skill: "Tiếng Anh giao tiếp",
    level: "Nâng cao",
    submittedAt: "2026-10-12T01:20:00Z",
    status: "PENDING",
    note: "Chứng chỉ IELTS 7.5 cấp tháng 6/2026, có thể tra cứu mã TRF.",
    files: [
      { name: "ielts-trf.pdf", mime: "application/pdf", size: 812_000 },
      { name: "ielts-anh-the.jpg", mime: "image/jpeg", size: 1_240_000 },
    ],
  },
  {
    id: "ev_102",
    userId: "usr_04",
    skill: "Lập trình Python",
    level: "Trung cấp",
    submittedAt: "2026-10-11T19:05:00Z",
    status: "PENDING",
    note: "Link GitHub các dự án cá nhân và bằng tốt nghiệp ngành CNTT.",
    files: [
      { name: "bang-tot-nghiep.pdf", mime: "application/pdf", size: 2_100_000 },
    ],
  },
  {
    id: "ev_103",
    userId: "usr_05",
    skill: "Nhiếp ảnh",
    level: "Cơ bản",
    submittedAt: "2026-10-11T08:40:00Z",
    status: "PENDING",
    note: "Portfolio 12 ảnh chụp chân dung.",
    files: [
      { name: "portfolio-1.jpg", mime: "image/jpeg", size: 3_400_000 },
      { name: "portfolio-2.jpg", mime: "image/jpeg", size: 2_900_000 },
      { name: "portfolio-3.png", mime: "image/png", size: 4_100_000 },
    ],
  },
  {
    id: "ev_104",
    userId: "usr_08",
    skill: "Guitar cơ bản",
    level: "Cơ bản",
    submittedAt: "2026-10-10T16:15:00Z",
    status: "PENDING",
    note: "Video biểu diễn 3 phút.",
    files: [{ name: "bieu-dien.mp4", mime: "video/mp4", size: 9_800_000 }],
  },
  {
    id: "ev_095",
    userId: "usr_01",
    skill: "Excel nâng cao",
    level: "Trung cấp",
    submittedAt: "2026-10-08T10:00:00Z",
    status: "APPROVED",
    note: "Chứng chỉ MOS.",
    files: [{ name: "mos.pdf", mime: "application/pdf", size: 640_000 }],
  },
  {
    id: "ev_090",
    userId: "usr_08",
    skill: "Thiết kế UI/UX",
    level: "Nâng cao",
    submittedAt: "2026-10-06T10:00:00Z",
    status: "REJECTED",
    note: "Ảnh chụp màn hình thiết kế.",
    files: [{ name: "figma.png", mime: "image/png", size: 520_000 }],
    rejectReason:
      "Ảnh không chứng minh được quyền sở hữu sản phẩm, vui lòng bổ sung file nguồn.",
  },
];

export type FlaggedRequest = {
  id: string;
  authorId: string;
  title: string;
  skill: string;
  body: string;
  flags: string[];
  categories: string[];
  submittedAt: string;
  status: "PENDING_MODERATION" | "OPEN" | "REJECTED";
  rejectReason?: string;
};

export const FLAGGED: FlaggedRequest[] = [
  {
    id: "lr_301",
    authorId: "usr_05",
    title: "Cần gia sư Excel, trả công ngoài nền tảng",
    skill: "Excel nâng cao",
    body: "Mình cần học Excel nâng cao 2 buổi/tuần. Ai nhận dạy thì liên hệ zalo 09xx để thanh toán trực tiếp, không qua web cho nhanh nhé.",
    flags: ["thanh toán trực tiếp", "zalo"],
    categories: ["Giao dịch ngoài nền tảng"],
    submittedAt: "2026-10-12T02:00:00Z",
    status: "PENDING_MODERATION",
  },
  {
    id: "lr_302",
    authorId: "usr_02",
    title: "Học Python để làm bot tự động",
    skill: "Lập trình Python",
    body: "Mình muốn học Python cơ bản để viết bot tự động hóa việc nhập liệu. Có thể trao đổi lại kỹ năng thiết kế slide.",
    flags: ["bot"],
    categories: ["Từ khóa cần xem xét"],
    submittedAt: "2026-10-11T22:30:00Z",
    status: "PENDING_MODERATION",
  },
  {
    id: "lr_303",
    authorId: "usr_07",
    title: "Cần người dạy tiếng Anh, cam kết đậu 100%",
    skill: "Tiếng Anh giao tiếp",
    body: "Cam kết đậu 100% IELTS 8.0 chỉ sau 2 tuần, học phí rẻ.",
    flags: ["cam kết", "100%"],
    categories: ["Quảng cáo sai sự thật"],
    submittedAt: "2026-10-11T15:10:00Z",
    status: "PENDING_MODERATION",
  },
  {
    id: "lr_290",
    authorId: "usr_04",
    title: "Trao đổi Guitar và Piano",
    skill: "Guitar cơ bản",
    body: "Mình biết Guitar, muốn học Piano cơ bản.",
    flags: [],
    categories: [],
    submittedAt: "2026-10-09T09:00:00Z",
    status: "OPEN",
  },
];

export type MaterialItem = {
  id: string;
  sellerId: string;
  title: string;
  access: "FREE" | "PAID";
  priceCredit: number;
  mime: string;
  size: number;
  submittedAt: string;
  scan: "CLEAN" | "SUSPICIOUS";
  status: "PENDING_REVIEW" | "PUBLISHED" | "REJECTED";
  rejectReason?: string;
};

export const MATERIALS: MaterialItem[] = [
  {
    id: "mt_401",
    sellerId: "usr_04",
    title: "Bộ bài tập Python từ cơ bản đến nâng cao",
    access: "PAID",
    priceCredit: 60,
    mime: "application/pdf",
    size: 4_800_000,
    submittedAt: "2026-10-12T00:30:00Z",
    scan: "CLEAN",
    status: "PENDING_REVIEW",
  },
  {
    id: "mt_402",
    sellerId: "usr_01",
    title: "Từ vựng IELTS theo chủ đề",
    access: "FREE",
    priceCredit: 0,
    mime: "application/pdf",
    size: 1_900_000,
    submittedAt: "2026-10-11T17:00:00Z",
    scan: "CLEAN",
    status: "PENDING_REVIEW",
  },
  {
    id: "mt_403",
    sellerId: "usr_08",
    title: "Template CV chuyên nghiệp",
    access: "PAID",
    priceCredit: 30,
    mime: "application/zip",
    size: 7_200_000,
    submittedAt: "2026-10-10T12:00:00Z",
    scan: "SUSPICIOUS",
    status: "PENDING_REVIEW",
  },
  {
    id: "mt_390",
    sellerId: "usr_05",
    title: "Preset Lightroom chân dung",
    access: "PAID",
    priceCredit: 45,
    mime: "application/zip",
    size: 3_100_000,
    submittedAt: "2026-10-05T12:00:00Z",
    scan: "CLEAN",
    status: "PUBLISHED",
  },
];

// ---------- Disputes ----------

export type ReportStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "NEED_MORE_INFO"
  | "RESOLVED"
  | "REJECTED"
  | "CLOSED";
export type ChatMessage =
  | { id: string; kind: "text"; from: string; text: string; at: string }
  | { id: string; kind: "plan"; from: string; text: string; at: string }
  | { id: string; kind: "schedule"; from: string; text: string; at: string };

export type Dispute = {
  id: string;
  target: "SESSION" | "USER" | "MESSAGE" | "MATERIAL" | "CREDIT_TRANSACTION";
  reporterId: string;
  againstId: string;
  reason: string;
  description: string;
  status: ReportStatus;
  priority: "HIGH" | "NORMAL";
  escalated: boolean;
  createdAt: string;
  evidence: EvidenceFile[];
  session?: {
    id: string;
    startAt: string;
    minutes: number;
    status: string;
    joined: { userId: string; at: string; left: string }[];
    confirmedBy: string[];
    heldCredit: number;
  };
  chat: ChatMessage[];
  decision?: { outcome: "RESOLVE" | "REJECT" | "ESCALATE"; reason: string };
};

export const DISPUTES: Dispute[] = [
  {
    id: "dp_501",
    target: "SESSION",
    reporterId: "usr_01",
    againstId: "usr_08",
    reason: "Người dạy không tham gia phiên học",
    description:
      "Mình vào phòng đúng giờ, chờ 25 phút nhưng bạn kia không xuất hiện. Nhắn tin cũng không trả lời.",
    status: "OPEN",
    priority: "HIGH",
    escalated: false,
    createdAt: "2026-10-12T00:10:00Z",
    evidence: [
      { name: "man-hinh-phong-cho.png", mime: "image/png", size: 640_000 },
    ],
    session: {
      id: "ss_7781",
      startAt: "2026-10-11T13:00:00Z",
      minutes: 60,
      status: "DISPUTED",
      joined: [
        {
          userId: "usr_01",
          at: "2026-10-11T12:58:00Z",
          left: "2026-10-11T13:27:00Z",
        },
      ],
      confirmedBy: [],
      heldCredit: 40,
    },
    chat: [
      {
        id: "m1",
        kind: "plan",
        from: "usr_08",
        text: "Lộ trình đã tạo: Guitar cơ bản — 4 buổi × 60 phút",
        at: "2026-10-08T09:00:00Z",
      },
      {
        id: "m2",
        kind: "schedule",
        from: "usr_01",
        text: "Xác nhận lịch: 11/10/2026 20:00 (phiên 1/4)",
        at: "2026-10-08T10:30:00Z",
      },
      {
        id: "m3",
        kind: "text",
        from: "usr_01",
        text: "Bạn ơi 8h tối nay mình học nhé, mình vào phòng rồi.",
        at: "2026-10-11T12:55:00Z",
      },
      {
        id: "m4",
        kind: "text",
        from: "usr_01",
        text: "Bạn có ở đó không? Mình chờ 20 phút rồi.",
        at: "2026-10-11T13:20:00Z",
      },
    ],
  },
  {
    id: "dp_502",
    target: "SESSION",
    reporterId: "usr_04",
    againstId: "usr_05",
    reason: "Nội dung buổi học không đúng thỏa thuận",
    description:
      "Lộ trình ghi dạy Python cơ bản nhưng buổi học chỉ nói chuyện chung chung, không có nội dung.",
    status: "UNDER_REVIEW",
    priority: "NORMAL",
    escalated: false,
    createdAt: "2026-10-10T18:00:00Z",
    evidence: [],
    session: {
      id: "ss_7702",
      startAt: "2026-10-10T13:00:00Z",
      minutes: 90,
      status: "AWAITING_CONFIRMATION",
      joined: [
        {
          userId: "usr_04",
          at: "2026-10-10T12:59:00Z",
          left: "2026-10-10T14:31:00Z",
        },
        {
          userId: "usr_05",
          at: "2026-10-10T13:02:00Z",
          left: "2026-10-10T14:30:00Z",
        },
      ],
      confirmedBy: ["usr_05"],
      heldCredit: 120,
    },
    chat: [
      {
        id: "m1",
        kind: "plan",
        from: "usr_05",
        text: "Lộ trình đã tạo: Python cơ bản — 3 buổi × 90 phút",
        at: "2026-10-06T09:00:00Z",
      },
      {
        id: "m2",
        kind: "text",
        from: "usr_04",
        text: "Buổi hôm nay mình chưa thấy học được gì cụ thể.",
        at: "2026-10-10T14:40:00Z",
      },
    ],
  },
  {
    id: "dp_503",
    target: "MESSAGE",
    reporterId: "usr_05",
    againstId: "usr_03",
    reason: "Tin nhắn quấy rối",
    description:
      "Người này liên tục gửi tin nhắn có lời lẽ xúc phạm sau khi bị từ chối proposal.",
    status: "NEED_MORE_INFO",
    priority: "HIGH",
    escalated: true,
    createdAt: "2026-10-09T07:30:00Z",
    evidence: [{ name: "tin-nhan.png", mime: "image/png", size: 410_000 }],
    chat: [
      {
        id: "m1",
        kind: "text",
        from: "usr_03",
        text: "(nội dung đã bị che do vi phạm — mở bằng quyền xem bằng chứng)",
        at: "2026-10-09T06:50:00Z",
      },
    ],
  },
  {
    id: "dp_504",
    target: "MATERIAL",
    reporterId: "usr_01",
    againstId: "usr_08",
    reason: "Tài liệu vi phạm bản quyền",
    description:
      "Tài liệu sao chép nguyên văn từ sách giáo trình có bản quyền.",
    status: "RESOLVED",
    priority: "NORMAL",
    escalated: false,
    createdAt: "2026-10-04T11:00:00Z",
    evidence: [],
    chat: [],
    decision: {
      outcome: "RESOLVE",
      reason:
        "Đã đối chiếu với giáo trình gốc, gỡ tài liệu và nhắc nhở người bán.",
    },
  },
];

// ---------- Credit ----------

export type LedgerEntry = {
  id: string;
  at: string;
  userId: string;
  type: string;
  amount: number;
  status: "SUCCESS" | "PENDING" | "FAILED" | "REVERSED";
  ref: string;
  note?: string;
};

export const LEDGER: LedgerEntry[] = [
  {
    id: "tx_9001",
    at: "2026-10-12T02:15:00Z",
    userId: "usr_04",
    type: "TOP_UP",
    amount: 500,
    status: "SUCCESS",
    ref: "PAYMENT:pay_3301",
  },
  {
    id: "tx_9000",
    at: "2026-10-12T01:00:00Z",
    userId: "usr_01",
    type: "HOLD",
    amount: -40,
    status: "SUCCESS",
    ref: "LEARNING_PATH:lp_221",
  },
  {
    id: "tx_8999",
    at: "2026-10-11T22:10:00Z",
    userId: "usr_05",
    type: "MATERIAL_PURCHASE",
    amount: -45,
    status: "SUCCESS",
    ref: "MATERIAL_ORDER:mo_88",
  },
  {
    id: "tx_8998",
    at: "2026-10-11T22:10:00Z",
    userId: "usr_04",
    type: "MATERIAL_SALE",
    amount: 43,
    status: "SUCCESS",
    ref: "MATERIAL_ORDER:mo_88",
  },
  {
    id: "tx_8997",
    at: "2026-10-11T22:10:00Z",
    userId: "usr_04",
    type: "PLATFORM_FEE",
    amount: -2,
    status: "SUCCESS",
    ref: "MATERIAL_ORDER:mo_88",
  },
  {
    id: "tx_8990",
    at: "2026-10-10T09:00:00Z",
    userId: "usr_08",
    type: "PENALTY",
    amount: -15,
    status: "SUCCESS",
    ref: "DISPUTE:dp_498",
  },
  {
    id: "tx_8985",
    at: "2026-10-09T09:00:00Z",
    userId: "usr_01",
    type: "ADJUSTMENT",
    amount: 20,
    status: "SUCCESS",
    ref: "SYSTEM",
    note: "Bồi hoàn lỗi hệ thống LiveKit ngày 08/10",
  },
  {
    id: "tx_8980",
    at: "2026-10-08T09:00:00Z",
    userId: "usr_03",
    type: "TOP_UP",
    amount: 100,
    status: "FAILED",
    ref: "PAYMENT:pay_3290",
  },
];

export type PaymentItem = {
  id: string;
  at: string;
  userId: string;
  vnd: number;
  credit: number;
  status: "CREATED" | "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";
  provider: string;
};

export const PAYMENTS: PaymentItem[] = [
  {
    id: "pay_3301",
    at: "2026-10-12T02:14:00Z",
    userId: "usr_04",
    vnd: 500_000,
    credit: 500,
    status: "PAID",
    provider: "VNPAY",
  },
  {
    id: "pay_3300",
    at: "2026-10-11T18:40:00Z",
    userId: "usr_01",
    vnd: 200_000,
    credit: 200,
    status: "PAID",
    provider: "MOMO",
  },
  {
    id: "pay_3295",
    at: "2026-10-10T08:00:00Z",
    userId: "usr_05",
    vnd: 100_000,
    credit: 100,
    status: "PENDING",
    provider: "VNPAY",
  },
  {
    id: "pay_3290",
    at: "2026-10-08T08:55:00Z",
    userId: "usr_03",
    vnd: 100_000,
    credit: 100,
    status: "FAILED",
    provider: "VNPAY",
  },
  {
    id: "pay_3280",
    at: "2026-10-06T14:00:00Z",
    userId: "usr_08",
    vnd: 50_000,
    credit: 50,
    status: "REFUNDED",
    provider: "MOMO",
  },
];

// ---------- Content ----------

export type ContentRow = {
  id: string;
  kind: "REQUEST" | "PATH" | "SESSION";
  title: string;
  ownerId: string;
  status: string;
  hidden: boolean;
  at: string;
};

export const CONTENT: ContentRow[] = [
  {
    id: "lr_290",
    kind: "REQUEST",
    title: "Trao đổi Guitar và Piano",
    ownerId: "usr_04",
    status: "OPEN",
    hidden: false,
    at: "2026-10-09T09:00:00Z",
  },
  {
    id: "lr_281",
    kind: "REQUEST",
    title: "Học thiết kế logo trong 1 tháng",
    ownerId: "usr_05",
    status: "NEGOTIATING",
    hidden: false,
    at: "2026-10-07T09:00:00Z",
  },
  {
    id: "lr_270",
    kind: "REQUEST",
    title: "Dạy kèm IELTS giá rẻ — liên hệ ngoài",
    ownerId: "usr_08",
    status: "OPEN",
    hidden: true,
    at: "2026-10-02T09:00:00Z",
  },
  {
    id: "lp_221",
    kind: "PATH",
    title: "Guitar cơ bản ⇄ Thiết kế slide",
    ownerId: "usr_01",
    status: "ACTIVE",
    hidden: false,
    at: "2026-10-08T09:00:00Z",
  },
  {
    id: "lp_205",
    kind: "PATH",
    title: "Python cơ bản (một chiều)",
    ownerId: "usr_04",
    status: "DISPUTED",
    hidden: false,
    at: "2026-10-06T09:00:00Z",
  },
  {
    id: "ss_7781",
    kind: "SESSION",
    title: "Guitar cơ bản — buổi 1/4",
    ownerId: "usr_01",
    status: "DISPUTED",
    hidden: false,
    at: "2026-10-11T13:00:00Z",
  },
  {
    id: "ss_7702",
    kind: "SESSION",
    title: "Python cơ bản — buổi 1/3",
    ownerId: "usr_04",
    status: "AWAITING_CONFIRMATION",
    hidden: false,
    at: "2026-10-10T13:00:00Z",
  },
];

// ---------- Reputation ----------

export type ReviewRow = {
  id: string;
  authorId: string;
  targetId: string;
  rating: number;
  text: string;
  flagged: boolean;
  hidden: boolean;
  at: string;
};

export const REVIEWS: ReviewRow[] = [
  {
    id: "rv_61",
    authorId: "usr_08",
    targetId: "usr_01",
    rating: 1,
    text: "Dạy tệ, đồ lừa đảo, ai học là mất tiền. Đừng tin con này!",
    flagged: true,
    hidden: false,
    at: "2026-10-11T10:00:00Z",
  },
  {
    id: "rv_60",
    authorId: "usr_05",
    targetId: "usr_04",
    rating: 5,
    text: "Dạy rất dễ hiểu, có tài liệu kèm theo.",
    flagged: false,
    hidden: false,
    at: "2026-10-10T10:00:00Z",
  },
  {
    id: "rv_58",
    authorId: "usr_03",
    targetId: "usr_05",
    rating: 2,
    text: "Liên hệ zalo 09xx để được giảm giá nhé.",
    flagged: true,
    hidden: true,
    at: "2026-10-05T10:00:00Z",
  },
  {
    id: "rv_55",
    authorId: "usr_01",
    targetId: "usr_02",
    rating: 4,
    text: "Nhiệt tình, đúng giờ.",
    flagged: false,
    hidden: false,
    at: "2026-10-03T10:00:00Z",
  },
];

export const BADGES = [
  {
    code: "FIRST_SESSION",
    name: "Buổi học đầu tiên",
    desc: "Hoàn thành phiên học đầu tiên.",
    holders: 412,
  },
  {
    code: "TRUSTED_TEACHER",
    name: "Người dạy tin cậy",
    desc: "10 phiên COMPLETED, điểm TB ≥ 4.5.",
    holders: 87,
  },
  {
    code: "SKILL_VERIFIED",
    name: "Kỹ năng đã xác minh",
    desc: "Có ít nhất 1 bằng chứng được duyệt.",
    holders: 156,
  },
  {
    code: "MATERIAL_AUTHOR",
    name: "Tác giả tài liệu",
    desc: "Có tài liệu được đăng bán.",
    holders: 34,
  },
];

// ---------- Audit ----------

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  role: RoleCode;
  action: string;
  target: string;
  reason?: string;
  before?: string;
  after?: string;
};

export const AUDIT: AuditEntry[] = [
  {
    id: "au_5002",
    at: "2026-10-12T02:30:00Z",
    actor: "Đặng Hoàng Nam",
    role: "ADMIN",
    action: "USER_LOCK",
    target: "USER:usr_03",
    reason: "Quấy rối người dùng khác, 3 báo cáo đã xác thực.",
    before: "ACTIVE",
    after: "LOCKED",
  },
  {
    id: "au_5001",
    at: "2026-10-12T01:10:00Z",
    actor: "Trần Quốc Bảo",
    role: "STAFF",
    action: "VERIFY_SKILL_APPROVE",
    target: "EVIDENCE:ev_095",
    before: "PENDING",
    after: "APPROVED",
  },
  {
    id: "au_5000",
    at: "2026-10-11T16:20:00Z",
    actor: "Trần Quốc Bảo",
    role: "STAFF",
    action: "VERIFY_SKILL_REJECT",
    target: "EVIDENCE:ev_090",
    reason: "Ảnh không chứng minh được quyền sở hữu sản phẩm.",
    before: "PENDING",
    after: "REJECTED",
  },
  {
    id: "au_4999",
    at: "2026-10-11T09:45:00Z",
    actor: "Đặng Hoàng Nam",
    role: "ADMIN",
    action: "CREDIT_ADJUST",
    target: "USER:usr_01",
    reason: "Bồi hoàn lỗi hệ thống LiveKit ngày 08/10.",
    before: "320",
    after: "340",
  },
  {
    id: "au_4998",
    at: "2026-10-10T14:00:00Z",
    actor: "Đặng Hoàng Nam",
    role: "ADMIN",
    action: "SKILL_CATALOG_ARCHIVE",
    target: "SKILL:sk_09",
    reason: "Không còn nhu cầu, không có tham chiếu.",
    before: "ACTIVE",
    after: "ARCHIVED",
  },
  {
    id: "au_4997",
    at: "2026-10-10T08:30:00Z",
    actor: "Trần Quốc Bảo",
    role: "STAFF",
    action: "LEARNING_REQUEST_MODERATE",
    target: "LEARNING_REQUEST:lr_270",
    reason: "Dẫn dắt giao dịch ngoài nền tảng.",
    before: "PENDING_MODERATION",
    after: "REJECTED",
  },
  {
    id: "au_4996",
    at: "2026-10-09T13:00:00Z",
    actor: "Trần Quốc Bảo",
    role: "STAFF",
    action: "REPORT_EVIDENCE_READ",
    target: "REPORT:dp_503",
  },
  {
    id: "au_4995",
    at: "2026-10-08T10:00:00Z",
    actor: "Đặng Hoàng Nam",
    role: "ADMIN",
    action: "ROLE_PERMISSION_CHANGE",
    target: "USER:usr_02",
    reason: "Bổ nhiệm làm nhân sự kiểm duyệt.",
    before: "USER",
    after: "USER, STAFF",
  },
];

export const AUDIT_ACTIONS = [...new Set(AUDIT.map((a) => a.action))];

// ---------- Dashboard ----------

export const KPI = {
  users: { total: 1284, delta: 4.2 },
  sessionsWeek: { total: 342, delta: 8.1 },
  creditVolume: { total: 48_600, delta: -2.4 },
  platformFee: { total: 1_944, delta: 6.7 },
};

export const SESSIONS_PER_DAY = [
  { day: "T2", value: 41 },
  { day: "T3", value: 52 },
  { day: "T4", value: 48 },
  { day: "T5", value: 61 },
  { day: "T6", value: 57 },
  { day: "T7", value: 44 },
  { day: "CN", value: 39 },
];

// ---------- Config ----------

export const CONFIG_LOCKED = [
  {
    key: "credit.pathSettlementBps",
    label: "Phí nền tảng",
    value: "4% (96% hoàn lại / chuyển cho người dạy)",
    note: "Cố định theo SRS 1.6",
  },
  {
    key: "credit.topUpVndPerCredit",
    label: "Tỷ giá nạp",
    value: "1.000 ₫ = 1 Credit",
    note: "Cố định theo SRS 1.6",
  },
  {
    key: "schedule.rescheduleCutoffMinutes",
    label: "Cutoff đổi lịch",
    value: "60 phút trước giờ bắt đầu",
    note: "Cố định theo SRS 1.6",
  },
  {
    key: "session.durationMinutes",
    label: "Thời lượng phiên",
    value: "60 – 180 phút",
    note: "Cố định theo SRS 1.6",
  },
  {
    key: "learningPath.minCreditPerUser",
    label: "Credit tối thiểu mỗi người",
    value: "20 Credit",
    note: "Cố định theo SRS 1.6",
  },
  {
    key: "reputation.initial",
    label: "Điểm uy tín khởi tạo",
    value: "50",
    note: "Do backend điều khiển",
  },
];

export const MODERATION_RULES = [
  {
    id: "r1",
    label: "Giao dịch ngoài nền tảng",
    patterns: ["zalo", "thanh toán trực tiếp", "chuyển khoản riêng"],
  },
  {
    id: "r2",
    label: "Quảng cáo sai sự thật",
    patterns: ["cam kết đậu", "100%", "bao đậu"],
  },
  { id: "r3", label: "Nội dung nhạy cảm", patterns: ["cá độ", "cờ bạc"] },
];
