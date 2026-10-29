import { FormNotice } from "@/components/FormNotice";
import { Copy } from "@/components/feature-page";
import { ConnectionFeedback } from "@/features/connections";
import type { useExistingScheduleCheck } from "../hooks/use-existing-schedule-check";

export function ScheduleExistingFeedback({
  check,
}: Readonly<{ check: ReturnType<typeof useExistingScheduleCheck> }>) {
  if (!check.hasSlots) return null;
  if (check.pending)
    return (
      <FormNotice tone="info" compact>
        Đang kiểm tra lịch đã có…
      </FormNotice>
    );
  if (check.error || check.denial)
    return (
      <>
        <FormNotice tone="error" compact>
          Không kiểm tra được Session đã có. Chưa thể gửi lịch; hãy tải lại phần
          kiểm tra. Lịch đang nhập vẫn được giữ.
        </FormNotice>
        <ConnectionFeedback error={check.error} retry={check.retry} />
      </>
    );
  return (
    <>
      {check.limited && (
        <FormNotice tone="error" compact>
          Đã tải tối đa 100 buổi; có thể còn lịch chưa được kiểm tra. Mở Sửa
          từng buổi để xem giờ bị trùng. Chưa thể gửi khi chưa đối chiếu đủ
          Session.
        </FormNotice>
      )}
      {check.available && !check.limited && !check.conflicts.length && (
        <Copy muted size="hint">
          Đã đối chiếu với {check.checkedSessionCount} buổi học đã có.
        </Copy>
      )}
    </>
  );
}
