import { ActivityIndicator, View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { AppError, errorMessage } from "@/lib/http/errors";
import { colors } from "@/constants/theme";

const errors: Record<string, string> = {
  CHAT_OUTBOX_STORAGE_UNAVAILABLE:
    "Chưa tải được tin nhắn chờ gửi trên thiết bị. Thử lại.",
  INVALID_TEXT:
    "Nội dung chưa hợp lệ sau khi hệ thống xử lý văn bản thuần. Kiểm tra độ dài và ký tự trong nội dung.",
  INVALID_CREDIT_AMOUNT:
    "Nhập Credit lớn hơn 0, không có số 0 đầu và tối đa 2 chữ số thập phân.",
  INVALID_CREDIT_HINT:
    "Mức Credit gợi ý chưa phù hợp với quy định hiện tại. Điều chỉnh hoặc bỏ trống mức gợi ý.",
  INVALID_SESSION_COUNT_HINT:
    "Số buổi dự kiến vượt giới hạn hiện tại của hệ thống. Điều chỉnh hoặc bỏ trống số buổi.",
  INVALID_DURATION_HINT:
    "Thời lượng gợi ý phải là số nguyên từ 60 đến 180 phút.",
  INVALID_CANDIDATE_SLOTS:
    "Lịch rảnh chưa hợp lệ. Hãy nhập gợi ý bằng văn bản để cùng trao đổi.",
  CONNECTION_POLICY_UNAVAILABLE:
    "Máy chủ chưa cấu hình giới hạn cho gợi ý này. Bạn có thể bỏ trống số buổi dự kiến; với học một chiều, bỏ trống cả Credit gợi ý rồi thử lại.",
  PATH_CREATE_RECONCILE_REQUIRED:
    "Lần tạo trước đã gửi nhưng chưa xác định được kết quả. Tải lại danh sách và mở Learning Path đã tạo; chưa thể gửi lại để tránh trùng.",
  STALE_LEARNING_PATH_VERSION:
    "Điều khoản đã thay đổi. Tải lại và xem phiên bản mới trước khi xác nhận.",
  STALE_LEARNING_PLAN_VERSION:
    "Kế hoạch đã thay đổi. Tải lại nội dung mới trước khi xác nhận.",
  STALE_SCHEDULE_VERSION: "Lịch đã thay đổi. Tải lại và kiểm tra lịch mới.",
  INSUFFICIENT_AVAILABLE_CREDIT:
    "Số dư khả dụng chưa đủ để tạm giữ Credit cho Learning Path.",
  SCHEDULE_CONFLICT:
    "Lịch học bị trùng. Kiểm tra lại các buổi học trước khi chốt.",
  SCHEDULE_PROPOSAL_ALREADY_EXISTS:
    "Đã có đề xuất lịch cho kế hoạch này. Tải lại để xem lịch đã gửi.",
  LEARNING_PLAN_DIRECTION_ALREADY_EXISTS:
    "Đã có kế hoạch cho chiều dạy này. Tải lại để kiểm tra.",
  LEARNING_PATH_NOT_CONFIRMED:
    "Hai bên cần xác nhận đầy đủ kế hoạch và điều khoản trước khi tạo lịch.",
  LEARNING_PATH_NOT_EDITABLE:
    "Learning Path không còn cho phép chỉnh sửa. Hãy tải lại trạng thái.",
  PROPOSAL_ALREADY_PENDING:
    "Bạn đã có đề xuất đang chờ. Mở danh sách đã gửi để kiểm tra.",
  PROPOSAL_EXPIRED: "Đề xuất đã hết hạn. Hãy tải lại trạng thái.",
  PROPOSAL_VERSION_CONFLICT: "Đề xuất đã thay đổi. Tải lại trước khi thao tác.",
  REQUEST_NOT_AVAILABLE:
    "Yêu cầu học không còn nhận đề xuất hoặc đã được kết nối.",
  REQUEST_VERSION_CONFLICT: "Yêu cầu học đã thay đổi. Hãy xem lại nội dung.",
  TEACHER_SKILL_NOT_ELIGIBLE:
    "Kỹ năng của bạn chưa đáp ứng điều kiện gửi đề xuất.",
  DIRECT_TARGET_UNAVAILABLE: "Kỹ năng hoặc người nhận không còn khả dụng.",
  FILE_NOT_READY:
    "Tệp chưa hoàn tất kiểm tra. Vui lòng kiểm tra lại trạng thái.",
  FILE_TOO_LARGE: "Tệp vượt giới hạn 15 MB.",
  COMMAND_RECONCILE_REQUIRED:
    "Chưa xác định được kết quả lần gửi trước. Giữ nguyên nội dung và thử lại để tránh gửi trùng.",
};
export function connectionError(error: unknown) {
  if (error instanceof AppError) {
    if (errors[error.code]) return errors[error.code];
    if (error.status === 503)
      return "Dịch vụ đang chưa sẵn sàng. Giữ nội dung và thử lại sau.";
    if ([403, 404].includes(error.status))
      return "Nội dung không còn khả dụng hoặc bạn không có quyền truy cập.";
    if (error.status === 409)
      return "Trạng thái đã thay đổi. Tải lại trước khi thao tác.";
    if (error.kind === "protocol")
      return "Dữ liệu máy chủ chưa đúng hợp đồng. Vui lòng thử tải lại.";
  }
  return errorMessage(error);
}
export function ConnectionFeedback({
  loading,
  error,
  retry,
}: Readonly<{
  loading?: boolean;
  error?: unknown;
  retry?: () => unknown;
}>) {
  return (
    <View style={{ gap: 10 }}>
      {loading && (
        <ActivityIndicator
          color={colors.brand}
          accessibilityLabel="Đang tải dữ liệu"
        />
      )}
      {!!error && (
        <FormNotice tone="error">{connectionError(error)}</FormNotice>
      )}
      {!!error && retry && (
        <Button
          variant="secondary"
          onPress={() => {
            retry();
          }}
        >
          Thử tải lại
        </Button>
      )}
    </View>
  );
}
