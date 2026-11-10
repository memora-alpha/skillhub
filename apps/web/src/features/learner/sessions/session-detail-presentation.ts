import type { LearningPath, LearningSession } from "../types";
import { allSessionsCompleted } from "../paths/settlement-policy";
import { canEnterSession } from "./session-policy";
import { sessionMakeupState } from "./session-makeup-policy";

export type SessionPresentation = {
  tone: "info" | "warning" | "success" | "danger";
  title: string;
  description: string;
  room: string;
  step: number;
};

const view = (
  tone: SessionPresentation["tone"],
  title: string,
  description: string,
  room: string,
  step = 0,
): SessionPresentation => ({ tone, title, description, room, step });

export function sessionPresentation(
  session: LearningSession,
  userId: string,
  now: number,
  path?: LearningPath,
): SessionPresentation {
  if (session.status === "CANCELLED")
    return view(
      "info",
      "Buổi học đã được hủy",
      "Xem lộ trình để theo dõi lịch hoặc quyết định tiếp theo.",
      "Buổi học đã hủy",
    );
  if (
    session.status === "DISPUTED" ||
    path?.status === "DISPUTED" ||
    session.attendance?.outcomeStatus === "DISPUTED"
  )
    return view(
      "danger",
      "Buổi học có vấn đề đang được xử lý",
      "Theo dõi vụ việc và các bước cần làm trong lộ trình. Quyết toán phụ thuộc kết quả xử lý.",
      "Chưa thể vào phòng",
      1,
    );
  if (session.status === "COMPLETED") return completedPresentation(path);
  if (session.status === "MAKEUP_REQUIRED")
    return makeupPresentation(session, now, path);
  if (session.status === "NO_SHOW")
    return noShowPresentation(session, now, path);
  if (canEnterSession(session, now))
    return view(
      "success",
      session.status === "ONGOING"
        ? "Buổi học đang diễn ra"
        : "Phòng học đã sẵn sàng",
      "Bạn có thể tham gia hoặc trở lại phòng trong cửa sổ máy chủ cho phép.",
      "Phòng học đang mở",
    );
  if (session.attendance?.state === "PENDING_DATA")
    return view(
      "info",
      "Đang tổng hợp dữ liệu tham gia",
      "Máy chủ đang đối chiếu thời lượng. Đây chưa phải kết luận có mặt hoặc vắng học.",
      "Buổi học đã kết thúc",
      1,
    );
  if (session.status === "AWAITING_CONFIRMATION")
    return confirmationPresentation(session, userId);
  return view(
    "info",
    "Theo dõi lịch buổi học",
    "Thông tin mở phòng và quyền tham gia được cập nhật theo trạng thái hiện tại của buổi học.",
    "Thông tin phòng học",
  );
}

function completedPresentation(path?: LearningPath): SessionPresentation {
  if (path?.status === "COMPLETED" && path.settledAt)
    return view(
      "success",
      "Thỏa thuận đã hoàn tất và quyết toán",
      "Bạn có thể xem lịch sử Credit và đánh giá đối phương cho toàn bộ lộ trình.",
      "Đã hoàn tất quyết toán",
      4,
    );
  if (path && allSessionsCompleted(path))
    return view(
      "warning",
      "Bạn đã hoàn thành tất cả buổi học",
      "Theo dõi quyết toán bên dưới. Xác nhận buổi học và đồng ý quyết toán là hai thao tác riêng.",
      "Đã học đủ, chờ quyết toán",
      3,
    );
  return view(
    "success",
    "Buổi học đã được chốt hoàn thành",
    "Tiến độ được cập nhật theo kết quả máy chủ. Credit được xử lý ở bước quyết toán cả thỏa thuận.",
    "Buổi học đã kết thúc",
    2,
  );
}

function noShowPresentation(
  session: LearningSession,
  now: number,
  path?: LearningPath,
): SessionPresentation {
  const makeup = sessionMakeupState(session, now, path?.status);

  const both = session.attendance?.case === "BOTH_ABSENT";
  const provisional = session.attendance?.outcomeStatus === "PROVISIONAL";
  let description = "Xem kết quả điểm danh và các thao tác được phép bên dưới.";
  if (provisional)
    description =
      "Kết quả đang trong thời hạn xử lý. Bạn có thể phản hồi hoặc báo cáo khi thao tác tương ứng còn được phép.";
  if (both)
    description =
      makeup === "waiting"
        ? "Kết quả đang trong thời hạn phản hồi. Khi hết hạn, hệ thống tự xét cấp học bù nếu đủ điều kiện và không có báo cáo đang mở. Theo dõi bước tiếp theo bên dưới."
        : "Đang chờ máy chủ chốt kết quả và quyền học bù. Trang tự kiểm tra lại mỗi 30 giây; bạn không cần gửi yêu cầu duyệt lịch.";
  return view(
    "danger",
    both
      ? "Hệ thống ghi nhận cả hai người đều vắng"
      : "Hệ thống ghi nhận có người vắng học",
    description,
    "Phòng học không còn cho phép tham gia",
    1,
  );
}

function confirmationPresentation(
  session: LearningSession,
  userId: string,
): SessionPresentation {
  const confirmed =
    (session.teacherId === userId
      ? session.teacherConfirmationStatus
      : session.learnerConfirmationStatus) === "CONFIRMED";
  if (confirmed)
    return view(
      "info",
      "Đã ghi nhận xác nhận của bạn",
      "Đang chờ đối tác xác nhận hoặc máy chủ xử lý khi đến hạn. Bạn không cần gửi lại xác nhận.",
      "Buổi học đã kết thúc",
      1,
    );
  if (session.allowedActions?.includes("CONFIRM_COMPLETION"))
    return view(
      "warning",
      "Vui lòng xác nhận sau buổi học",
      "Kiểm tra kết quả điểm danh và xác nhận đã học trước thời hạn được hiển thị.",
      "Buổi học đã kết thúc",
      1,
    );
  return view(
    "info",
    "Đang chờ máy chủ cập nhật kết quả",
    "Xem thời hạn và kết quả tham gia. Thao tác xác nhận sẽ xuất hiện khi được phép.",
    "Buổi học đã kết thúc",
    1,
  );
}

function makeupPresentation(
  session: LearningSession,
  now: number,
  path?: LearningPath,
): SessionPresentation {
  const makeup = sessionMakeupState(session, now, path?.status);
  return view(
    "warning",
    makeup === "closed"
      ? "Đã hết hạn chốt lịch học bù"
      : "Cùng đối tác thống nhất lịch học bù",
    makeup === "closed"
      ? "Đang chờ máy chủ cập nhật hướng xử lý. Bạn chưa thể gửi hoặc xác nhận lịch mới."
      : "Buổi học đã được cấp học bù. Chọn thời gian và cùng xác nhận tại phần học bù bên dưới để áp dụng lịch mới.",
    makeup === "closed"
      ? "Chờ cập nhật kết quả học bù"
      : "Chờ hai bên chốt lịch học bù",
    1,
  );
}
