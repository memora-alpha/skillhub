/** Display text only. Permission codes sent to the API remain unchanged. */
const staffPermissionText: Readonly<
  Record<string, { label: string; description: string }>
> = {
  "chat-attachment:moderate": {
    label: "Kiểm duyệt tệp đính kèm tin nhắn",
    description:
      "Xem hàng đợi tệp chat bị gắn cờ kiểm duyệt và thu hồi quyền tải tệp vi phạm.",
  },
  "learning-path:terminate": {
    label: "Duyệt dừng lộ trình",
    description:
      "Duyệt yêu cầu dừng lộ trình theo phương án phân bổ Credit do hệ thống tính.",
  },
  "learning-request:approve": {
    label: "Duyệt yêu cầu học",
    description: "Cho phép đăng yêu cầu học đang chờ kiểm duyệt.",
  },
  "learning-request:moderation:read": {
    label: "Xem yêu cầu học cần kiểm duyệt",
    description:
      "Xem danh sách yêu cầu học được hệ thống đánh dấu để kiểm tra.",
  },
  "learning-request:reject": {
    label: "Từ chối yêu cầu học",
    description: "Từ chối yêu cầu học không đáp ứng quy định nội dung.",
  },
  "material-review:moderate": {
    label: "Kiểm duyệt đánh giá tài liệu",
    description: "Xem báo cáo, ẩn hoặc khôi phục đánh giá về tài liệu.",
  },
  "material:moderate": {
    label: "Kiểm duyệt tài liệu",
    description: "Xét duyệt, ẩn hoặc khôi phục tài liệu học tập.",
  },
  "profile:moderate": {
    label: "Kiểm duyệt hồ sơ",
    description:
      "Kiểm tra ảnh đại diện và giới thiệu; ẩn nội dung hoặc yêu cầu chỉnh sửa.",
  },
  "report:classify": {
    label: "Phân loại mức độ báo cáo",
    description: "Cập nhật mức độ ưu tiên để sắp xếp việc xử lý báo cáo.",
  },
  "report:communicate": {
    label: "Trao đổi riêng khi xử lý báo cáo",
    description: "Trao đổi với các bên liên quan trong vụ việc được phân công.",
  },
  "report:group": {
    label: "Gom báo cáo và quyết định vụ việc",
    description: "Gom các báo cáo cùng một vụ việc và đưa ra quyết định chung.",
  },
  "report:moderate": {
    label: "Xử lý báo cáo và tranh chấp",
    description: "Xem xét và xử lý báo cáo, tranh chấp liên quan đến buổi học.",
  },
  "review:moderate": {
    label: "Kiểm duyệt đánh giá lộ trình",
    description: "Ẩn hoặc khôi phục đánh giá được gửi sau lộ trình học.",
  },
  "skill-verification:approve": {
    label: "Duyệt bằng chứng kỹ năng",
    description: "Công nhận kỹ năng khi bằng chứng đáp ứng yêu cầu xác minh.",
  },
  "skill-verification:read": {
    label: "Xem bằng chứng kỹ năng",
    description: "Xem danh sách và nội dung bằng chứng đang chờ xác minh.",
  },
  "skill-verification:reject": {
    label: "Từ chối bằng chứng kỹ năng",
    description: "Từ chối bằng chứng chưa đáp ứng yêu cầu xác minh kỹ năng.",
  },
};

export function staffPermissionPresentation(code: string) {
  return Object.hasOwn(staffPermissionText, code)
    ? staffPermissionText[code]!
    : {
        label: "Quyền chưa có bản dịch",
        description:
          "Quyền này cần được bổ sung tên và mô tả tiếng Việt trước khi điều chỉnh.",
      };
}

export const canDescribeStaffPermission = (code: string) =>
  Object.hasOwn(staffPermissionText, code);
