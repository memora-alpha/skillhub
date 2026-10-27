type DevelopmentFeature = {
  href: string;
  title: string;
  description: string;
  icon: "card" | "star" | "clock";
  previewTitle: string;
  columns: readonly string[];
  rows: readonly { id: string; cells: readonly string[] }[];
};

// Illustrative records for unfinished screens, independent of portal API data.
export const developmentFeatures = {
  credits: {
    href: "/admin/credits",
    title: "Quản trị Credit",
    description: "Theo dõi giao dịch Credit trên toàn hệ thống.",
    icon: "card",
    previewTitle: "Giao dịch Credit mẫu",
    columns: ["Mã giao dịch", "Người dùng", "Nội dung", "Credit", "Thời gian"],
    rows: [
      {
        id: "credit-01",
        cells: [
          "GD-MAU-001",
          "Nguyễn An",
          "Mua tài liệu",
          "−30",
          "27/10/2026 09:15",
        ],
      },
      {
        id: "credit-02",
        cells: [
          "GD-MAU-002",
          "Trần Bình",
          "Bán tài liệu",
          "+30",
          "27/10/2026 09:15",
        ],
      },
      {
        id: "credit-03",
        cells: [
          "GD-MAU-003",
          "Lê Chi",
          "Nạp Credit",
          "+100",
          "26/10/2026 16:40",
        ],
      },
      {
        id: "credit-04",
        cells: [
          "GD-MAU-004",
          "Phạm Duy",
          "Tạm giữ cho lộ trình học",
          "−50",
          "26/10/2026 14:20",
        ],
      },
      {
        id: "credit-05",
        cells: [
          "GD-MAU-005",
          "Võ Hà",
          "Hoàn Credit",
          "+20",
          "25/10/2026 11:05",
        ],
      },
    ],
  },
  reputation: {
    href: "/admin/reputation",
    title: "Quản trị uy tín",
    description: "Theo dõi điểm và lịch sử uy tín của người dùng.",
    icon: "star",
    previewTitle: "Lịch sử uy tín mẫu",
    columns: ["Người dùng", "Nội dung", "Thay đổi", "Điểm sau", "Thời gian"],
    rows: [
      {
        id: "reputation-01",
        cells: [
          "Nguyễn An",
          "Đánh giá từ người học",
          "+2",
          "62",
          "27/10/2026 10:00",
        ],
      },
      {
        id: "reputation-02",
        cells: [
          "Trần Bình",
          "Hoàn thành buổi học",
          "+1",
          "58",
          "27/10/2026 08:30",
        ],
      },
      {
        id: "reputation-03",
        cells: ["Lê Chi", "Hủy buổi học muộn", "−2", "48", "26/10/2026 17:00"],
      },
      {
        id: "reputation-04",
        cells: [
          "Phạm Duy",
          "Đánh giá từ người học",
          "+1",
          "55",
          "26/10/2026 15:15",
        ],
      },
      {
        id: "reputation-05",
        cells: ["Võ Hà", "Hoàn thành buổi học", "+1", "51", "25/10/2026 13:45"],
      },
    ],
  },
  audit: {
    href: "/admin/audit",
    title: "Nhật ký quản trị",
    description: "Tra cứu hoạt động quản trị và kiểm duyệt trong hệ thống.",
    icon: "clock",
    previewTitle: "Hoạt động quản trị mẫu",
    columns: ["Người thực hiện", "Thao tác", "Đối tượng", "Thời gian"],
    rows: [
      {
        id: "audit-01",
        cells: [
          "Admin Minh",
          "Mở khóa tài khoản",
          "Tài khoản MAU-001",
          "27/10/2026 10:30",
        ],
      },
      {
        id: "audit-02",
        cells: [
          "Staff Lan",
          "Duyệt bằng chứng kỹ năng",
          "Bằng chứng MAU-002",
          "27/10/2026 09:45",
        ],
      },
      {
        id: "audit-03",
        cells: [
          "Admin Minh",
          "Cập nhật kỹ năng",
          "Kỹ năng MAU-003",
          "26/10/2026 16:20",
        ],
      },
      {
        id: "audit-04",
        cells: [
          "Staff Huy",
          "Duyệt tài liệu",
          "Tài liệu MAU-004",
          "26/10/2026 14:10",
        ],
      },
      {
        id: "audit-05",
        cells: [
          "Admin Mai",
          "Duyệt đề xuất tag",
          "Đề xuất MAU-005",
          "25/10/2026 11:50",
        ],
      },
    ],
  },
} as const satisfies Record<string, DevelopmentFeature>;

export type DevelopmentFeatureKey = keyof typeof developmentFeatures;
