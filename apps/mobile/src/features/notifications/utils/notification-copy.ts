import type { InboxNotification } from "../api/notifications-api";

// The app currently uses Vietnamese. Translate server templates at presentation
// time so existing inbox entries also follow the app language. Never translate
// user-authored reasons or replace unfamiliar content with a generic message.
const titles: Record<string, string> = {
  "New message": "Tin nhắn mới",
  "Connection update": "Cập nhật kết nối",
  "Learning request update": "Cập nhật yêu cầu học",
  "Learning request not approved": "Yêu cầu học chưa được duyệt",
  "Skill evidence revoked": "Bằng chứng kỹ năng đã bị thu hồi",
  "Skill verification reviewed": "Kết quả xác minh kỹ năng",
  "Learning path scheduled": "Lộ trình học đã chốt lịch",
  "Learning path completed": "Lộ trình học đã hoàn tất",
  "Session report opened": "Báo cáo mới về buổi học",
  "Report case updated": "Cập nhật báo cáo",
  "Material published": "Tài liệu đã được xuất bản",
  "Material rejected": "Tài liệu chưa được duyệt",
  "Material hidden": "Tài liệu đã bị ẩn",
  "Material purchase refunded": "Đã hoàn Credit mua tài liệu",
  "Material order refunded": "Đơn mua tài liệu đã được hoàn Credit",
  "Material purchased": "Mua tài liệu thành công",
  "Material sold": "Tài liệu có lượt mua mới",
};

const bodies: Record<string, string> = {
  "A participant sent a message.": "Một người tham gia đã gửi tin nhắn.",
  "A connection proposal has an update.":
    "Một đề nghị kết nối có cập nhật mới.",
  "Your skill verification decision is available in its history.":
    "Kết quả xác minh kỹ năng đã có trong lịch sử xác minh.",
  "Your learning path schedule is now locked.":
    "Lịch học của lộ trình đã được chốt.",
  "Your learning path has completed and settlement is recorded.":
    "Lộ trình học đã hoàn tất và quyết toán đã được ghi nhận.",
  "A report was opened for a session you participated in.":
    "Có báo cáo mới về một buổi học bạn đã tham gia.",
  "Your learning material is now live.":
    "Tài liệu học tập của bạn đã được xuất bản.",
  "Your learning material was rejected. See the review reason.":
    "Tài liệu chưa được duyệt. Hãy xem lý do xét duyệt.",
  "Your learning material was hidden by Staff.":
    "Tài liệu của bạn đã bị nhân viên ẩn.",
  "Your material access was revoked and the Credit refund was completed.":
    "Quyền truy cập tài liệu đã bị thu hồi và Credit đã được hoàn lại.",
  "A material purchase was refunded from your available Credit.":
    "Một đơn mua tài liệu đã được hoàn tiền từ số dư Credit khả dụng của bạn.",
  "Your purchased material is ready to download.":
    "Tài liệu đã mua đã sẵn sàng để tải xuống.",
  "A buyer purchased your learning material.":
    "Có người vừa mua tài liệu học tập của bạn.",
};

export function notificationCopy(item: InboxNotification) {
  let body = bodies[item.body] ?? item.body;
  if (item.type === "learning-request.rejected") {
    body = item.body; // This publisher sends the staff's reason as the whole body.
  } else if (item.type === "LEARNING_REQUEST_REJECTED") {
    body = item.body.replace(
      /^Your learning request was rejected: /,
      "Yêu cầu học chưa được duyệt: ",
    );
  } else if (
    item.type === "report.case.updated" &&
    /^The report case status is [A-Z_]+\.$/.test(item.body)
  ) {
    // The payload omits status. Avoid inventing a state from the event type.
    const statuses: Record<string, string> = {
      OPEN: "đang mở",
      UNDER_REVIEW: "đang xem xét",
      NEED_MORE_INFO: "cần bổ sung thông tin",
      RESOLVED: "đã giải quyết",
      REJECTED: "đã từ chối",
      CLOSED: "đã đóng",
    };
    const status = item.body.slice(26, -1);
    body = statuses[status]
      ? `Trạng thái báo cáo: ${statuses[status]}.`
      : item.body;
  }
  return { title: titles[item.title] ?? item.title, body };
}

export function notificationTime(value: string, now = Date.now()) {
  const date = new Date(value);
  const minutes = Math.floor(Math.max(0, now - date.getTime()) / 60_000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} ngày trước`;
  return date.toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "numeric",
    ...(date.getFullYear() !== new Date(now).getFullYear()
      ? { year: "numeric" }
      : {}),
  });
}
