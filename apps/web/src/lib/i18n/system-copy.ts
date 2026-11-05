// Translate system-owned copy at display time, including records created before
// Vietnamese UI support. Keep API identifiers and user/staff-written text intact.
const achievements: Record<
  string,
  { title: string; description: string; legacyTitle?: string }
> = {
  VERIFIED_MEMBER: {
    title: "Thành viên đã xác minh",
    description: "Tài khoản đang hoạt động và đã xác minh email.",
    legacyTitle: "Verified Member",
  },
  FIRST_PATH: {
    title: "Lộ trình đầu tiên",
    description: "Hoàn thành một lộ trình học tập.",
    legacyTitle: "First Path",
  },
  FIVE_PATHS: {
    title: "Người xây dựng hành trình",
    description: "Hoàn thành năm lộ trình học tập.",
    legacyTitle: "Path Builder",
  },
  TEN_TEACHING_PATHS: {
    title: "Người hướng dẫn tận tâm",
    description: "Giảng dạy trong mười lộ trình đã hoàn thành.",
    legacyTitle: "Teaching Guide",
  },
  TRUSTED_MEMBER: {
    title: "Thành viên đáng tin cậy",
    description: "Đạt 70 điểm uy tín và hoàn thành năm lộ trình.",
    legacyTitle: "Trusted Member",
  },
  VETERAN: {
    title: "Thành viên kỳ cựu",
    description: "Tham gia nền tảng được 180 ngày và hoàn thành mười lộ trình.",
    legacyTitle: "Veteran",
  },
  THREE_VERIFIED_SKILLS: {
    title: "Kỹ năng đã xác minh",
    description: "Có ba kỹ năng được xác minh.",
    legacyTitle: "Verified Skills",
  },
  FIRST_VERIFIED_SKILL: {
    title: "Kỹ năng được công nhận",
    description: "Có kỹ năng đầu tiên được xác minh.",
  },
  FIVE_VERIFIED_SKILLS: {
    title: "Đa tài",
    description: "Có năm kỹ năng được xác minh.",
  },
  FIRST_TEACHING_PATH: {
    title: "Người dẫn đường",
    description: "Dạy trong lộ trình đầu tiên đã hoàn tất.",
  },
  FIVE_TEACHING_PATHS: {
    title: "Người truyền cảm hứng",
    description: "Dạy trong năm lộ trình đã hoàn tất.",
  },
  TEN_PATHS: {
    title: "Học không ngừng",
    description: "Hoàn tất mười lộ trình học tập.",
  },
};

export function achievementCopy(item: {
  code: string;
  title: string;
  description: string;
}) {
  const copy = Object.hasOwn(achievements, item.code)
    ? achievements[item.code]
    : undefined;
  return copy
    ? { title: copy.title, description: copy.description }
    : { title: item.title, description: item.description };
}

export function achievementTitle(title: string | null | undefined) {
  if (!title) return title;
  return (
    Object.values(achievements).find(
      (copy) => copy.legacyTitle === title || copy.title === title,
    )?.title ?? title
  );
}

const notificationTitles: Record<string, string> = {
  "Learning change updated": "Yêu cầu thay đổi lộ trình đã được cập nhật",
  "Learning path scheduled": "Lịch học của lộ trình đã được khóa",
  "Learning path completed": "Lộ trình học đã hoàn thành",
  "Learning request not approved": "Bài nhu cầu học chưa được duyệt",
  "Learning request update": "Cập nhật bài nhu cầu học",
  "New message": "Tin nhắn mới",
  "Connection update": "Cập nhật đề nghị kết nối",
  "Session report opened": "Đã mở báo cáo về buổi học",
  "Report case updated": "Báo cáo đã được cập nhật",
  "Session attendance recorded": "Đã ghi nhận điểm danh buổi học",
  "Absence explanation received": "Đã nhận giải trình vắng mặt",
  "Absence explanation decided": "Giải trình vắng mặt đã có phản hồi",
  "Session no-show finalized": "Đã chốt kết quả vắng mặt",
  "Session completed": "Buổi học đã hoàn thành",
  "Makeup session overdue": "Đã quá hạn sắp xếp buổi học bù",
  "Skill evidence revoked": "Minh chứng kỹ năng đã bị thu hồi",
  "Skill verification reviewed": "Yêu cầu xác minh kỹ năng đã được xét duyệt",
  "Material published": "Tài liệu đã được xuất bản",
  "Material rejected": "Tài liệu chưa được duyệt",
  "Material hidden": "Tài liệu đã bị ẩn",
  "Material purchase refunded": "Đã hoàn Credit cho tài liệu đã mua",
  "Material order refunded": "Đơn mua tài liệu đã được hoàn Credit",
  "Material purchased": "Đã mua tài liệu",
  "Material sold": "Tài liệu đã có người mua",
};

const notificationBodies: Record<string, string> = {
  "A cancellation or termination request changed. Open your learning path to review it.":
    "Yêu cầu hủy hoặc chấm dứt lộ trình đã thay đổi. Mở lộ trình học để xem chi tiết.",
  "Your learning path schedule is now locked.":
    "Lịch học của lộ trình đã được khóa.",
  "Your learning path has completed and settlement is recorded.":
    "Lộ trình học đã hoàn thành và đã ghi nhận quyết toán.",
  "A participant sent a message.":
    "Một thành viên trong cuộc trò chuyện đã gửi tin nhắn.",
  "A connection proposal has an update.": "Đề nghị kết nối có cập nhật mới.",
  "A report was opened for a session you participated in.":
    "Đã có báo cáo về một buổi học bạn tham gia.",
  "Attendance for your session has been determined. Check the session for next steps.":
    "Đã có kết quả điểm danh. Mở buổi học để xem bước tiếp theo.",
  "Your partner explained their absence. Please accept or reject it.":
    "Đối phương đã giải trình lý do vắng mặt. Vui lòng xem và chấp nhận hoặc từ chối.",
  "Your partner responded to your absence explanation.":
    "Đối phương đã phản hồi giải trình vắng mặt của bạn.",
  "The no-show result for your session is now final.":
    "Kết quả vắng mặt của buổi học đã được chốt.",
  "The confirmation window ended and the session was completed.":
    "Đã hết thời gian xác nhận và buổi học đã được ghi nhận hoàn thành.",
  "No makeup time was agreed in time; staff will review the session.":
    "Hai bên chưa thống nhất lịch học bù trong thời hạn; nhân viên sẽ xem xét buổi học.",
  "Your skill verification decision is available in its history.":
    "Đã có kết quả xét duyệt xác minh kỹ năng. Mở lịch sử xác minh để xem chi tiết.",
  "Your learning material is now live.":
    "Tài liệu học tập của bạn đã được công khai.",
  "Your learning material was rejected. See the review reason.":
    "Tài liệu học tập của bạn chưa được duyệt. Vui lòng xem lý do xét duyệt.",
  "Your learning material was hidden by Staff.":
    "Tài liệu học tập của bạn đã bị nhân viên ẩn.",
  "Your material access was revoked and the Credit refund was completed.":
    "Quyền truy cập tài liệu đã được thu hồi và Credit đã được hoàn lại.",
  "A material purchase was refunded from your available Credit.":
    "Đã hoàn Credit cho một đơn mua tài liệu từ số Credit khả dụng của bạn.",
  "Your purchased material is ready to download.":
    "Tài liệu bạn đã mua hiện có thể tải xuống.",
  "A buyer purchased your learning material.":
    "Một người dùng đã mua tài liệu học tập của bạn.",
};

const reportStatuses: Record<string, string> = {
  OPEN: "Mới tiếp nhận",
  UNDER_REVIEW: "Đang xem xét",
  NEED_MORE_INFO: "Cần bổ sung thông tin",
  RESOLVED: "Đã giải quyết",
  REJECTED: "Đã từ chối",
  CLOSED: "Đã đóng",
};

function lookup(copy: Record<string, string>, value: string) {
  return Object.hasOwn(copy, value) ? copy[value]! : value;
}

export function notificationCopy(item: { title: string; body: string }) {
  let body = lookup(notificationBodies, item.body);
  if (item.title === "Report case updated") {
    const status = /^The report case status is ([A-Z_]+)\.$/.exec(
      item.body,
    )?.[1];
    if (status)
      body = Object.hasOwn(reportStatuses, status)
        ? `Trạng thái báo cáo: ${reportStatuses[status]}.`
        : "Báo cáo đã được cập nhật. Mở báo cáo để xem chi tiết.";
  }
  const rejectedPrefix = "Your learning request was rejected: ";
  if (
    item.title === "Learning request update" &&
    item.body.startsWith(rejectedPrefix)
  )
    body =
      "Bài nhu cầu học chưa được duyệt. Lý do: " +
      item.body.slice(rejectedPrefix.length);
  return { title: lookup(notificationTitles, item.title), body };
}
