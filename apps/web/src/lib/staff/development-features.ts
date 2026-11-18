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
