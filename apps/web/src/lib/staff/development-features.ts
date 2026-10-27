type DevelopmentFeature = {
  href: string;
  title: string;
  description: string;
  icon: "card" | "star" | "clock";
  previewTitle: string;
  columns: readonly string[];
  rows: readonly {
    id: string;
    cells: readonly { id: string; value: string }[];
  }[];
};

type DevelopmentFeatureInput = Omit<DevelopmentFeature, "rows"> & {
  rows: readonly (readonly [id: string, ...values: string[]])[];
};

function createDevelopmentFeature({
  columns,
  rows,
  ...feature
}: DevelopmentFeatureInput): DevelopmentFeature {
  return {
    ...feature,
    columns,
    rows: rows.map(([id, ...values]) => ({
      id,
      cells: columns.map((column, index) => ({
        id: column,
        value: values[index] ?? "",
      })),
    })),
  };
}

// Illustrative records for unfinished screens, independent of portal API data.
const creditsRows: DevelopmentFeatureInput["rows"] = [
  [
    "credit-01",
    "GD-MAU-001",
    "Nguyễn An",
    "Mua tài liệu",
    "−30",
    "27/10/2026 09:15",
  ],
  [
    "credit-02",
    "GD-MAU-002",
    "Trần Bình",
    "Bán tài liệu",
    "+30",
    "27/10/2026 09:15",
  ],
  [
    "credit-03",
    "GD-MAU-003",
    "Lê Chi",
    "Nạp Credit",
    "+100",
    "26/10/2026 16:40",
  ],
  [
    "credit-04",
    "GD-MAU-004",
    "Phạm Duy",
    "Tạm giữ cho lộ trình học",
    "−50",
    "26/10/2026 14:20",
  ],
  [
    "credit-05",
    "GD-MAU-005",
    "Võ Hà",
    "Hoàn Credit",
    "+20",
    "25/10/2026 11:05",
  ],
];

const reputationRows: DevelopmentFeatureInput["rows"] = [
  [
    "reputation-01",
    "Nguyễn An",
    "Đánh giá từ người học",
    "+2",
    "62",
    "27/10/2026 10:00",
  ],
  [
    "reputation-02",
    "Trần Bình",
    "Hoàn thành buổi học",
    "+1",
    "58",
    "27/10/2026 08:30",
  ],
  [
    "reputation-03",
    "Lê Chi",
    "Hủy buổi học muộn",
    "−2",
    "48",
    "26/10/2026 17:00",
  ],
  [
    "reputation-04",
    "Phạm Duy",
    "Đánh giá từ người học",
    "+1",
    "55",
    "26/10/2026 15:15",
  ],
  [
    "reputation-05",
    "Võ Hà",
    "Hoàn thành buổi học",
    "+1",
    "51",
    "25/10/2026 13:45",
  ],
];

const auditRows: DevelopmentFeatureInput["rows"] = [
  [
    "audit-01",
    "Admin Minh",
    "Mở khóa tài khoản",
    "Tài khoản MAU-001",
    "27/10/2026 10:30",
  ],
  [
    "audit-02",
    "Staff Lan",
    "Duyệt bằng chứng kỹ năng",
    "Bằng chứng MAU-002",
    "27/10/2026 09:45",
  ],
  [
    "audit-03",
    "Admin Minh",
    "Cập nhật kỹ năng",
    "Kỹ năng MAU-003",
    "26/10/2026 16:20",
  ],
  [
    "audit-04",
    "Staff Huy",
    "Duyệt tài liệu",
    "Tài liệu MAU-004",
    "26/10/2026 14:10",
  ],
  [
    "audit-05",
    "Admin Mai",
    "Duyệt đề xuất tag",
    "Đề xuất MAU-005",
    "25/10/2026 11:50",
  ],
];

export const developmentFeatures = {
  credits: createDevelopmentFeature({
    href: "/admin/credits",
    title: "Quản trị Credit",
    description: "Theo dõi giao dịch Credit trên toàn hệ thống.",
    icon: "card",
    previewTitle: "Giao dịch Credit mẫu",
    columns: ["Mã giao dịch", "Người dùng", "Nội dung", "Credit", "Thời gian"],
    rows: creditsRows,
  }),
  reputation: createDevelopmentFeature({
    href: "/admin/reputation",
    title: "Quản trị uy tín",
    description: "Theo dõi điểm và lịch sử uy tín của người dùng.",
    icon: "star",
    previewTitle: "Lịch sử uy tín mẫu",
    columns: ["Người dùng", "Nội dung", "Thay đổi", "Điểm sau", "Thời gian"],
    rows: reputationRows,
  }),
  audit: createDevelopmentFeature({
    href: "/admin/audit",
    title: "Nhật ký quản trị",
    description: "Tra cứu hoạt động quản trị và kiểm duyệt trong hệ thống.",
    icon: "clock",
    previewTitle: "Hoạt động quản trị mẫu",
    columns: ["Người thực hiện", "Thao tác", "Đối tượng", "Thời gian"],
    rows: auditRows,
  }),
} as const satisfies Record<string, DevelopmentFeature>;

export type DevelopmentFeatureKey = keyof typeof developmentFeatures;
