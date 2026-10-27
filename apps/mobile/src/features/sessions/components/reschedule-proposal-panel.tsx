import { FormNotice } from "@/components/FormNotice";
import type { rescheduleSnapshot } from "../utils/reschedule-snapshot";
import { formatSessionTime } from "../utils/session-time";
import { SessionPanel, SessionCopy, SessionButton } from "./session-page";

type Snapshot = ReturnType<typeof rescheduleSnapshot>;

export function RescheduleProposalPanel({
  snapshot,
  timezone,
  loading,
  error,
  disabled,
  pending,
  onConfirm,
}: Readonly<{
  snapshot: Snapshot;
  timezone: string;
  loading: boolean;
  error: unknown;
  disabled: boolean;
  pending: boolean;
  onConfirm: () => void;
}>) {
  return (
    <SessionPanel title="Đề nghị đổi lịch hiện tại">
      <ProposalContent
        snapshot={snapshot}
        timezone={timezone}
        loading={loading}
      />
      {!!error && (
        <FormNotice tone="error">
          Chưa tải lại được đề nghị. Thông tin đang hiển thị có thể chưa cập
          nhật. Kéo xuống để thử lại.
        </FormNotice>
      )}
      {snapshot?.pending && !snapshot.ownConfirmed && (
        <SessionButton disabled={disabled} onPress={onConfirm}>
          {pending ? "Đang xử lý…" : "Xác nhận lịch mới"}
        </SessionButton>
      )}
      {snapshot?.pending && snapshot.ownConfirmed && (
        <FormNotice tone="info">
          Bạn đã xác nhận đề nghị này. Lịch mới chỉ có hiệu lực khi cả hai bên
          xác nhận và hệ thống chốt lịch.
        </FormNotice>
      )}
    </SessionPanel>
  );
}

function ProposalContent({
  snapshot,
  timezone,
  loading,
}: Readonly<{
  snapshot: Snapshot;
  timezone: string;
  loading: boolean;
}>) {
  if (!snapshot)
    return (
      <SessionCopy muted>
        {loading
          ? "Đang tải đề nghị đổi lịch…"
          : "Chưa đọc được đề nghị đổi lịch phù hợp với buổi học."}
      </SessionCopy>
    );
  if (!snapshot.pending)
    return (
      <SessionCopy muted>
        {snapshot.hasPending
          ? "Có đề nghị đổi lịch ở buổi khác trong cùng kế hoạch. Mở buổi đó để xem và xác nhận trước khi gửi đề nghị mới."
          : `Buổi học này chưa có lịch mới đang chờ xác nhận. Lịch bản ${snapshot.appliedVersion} đang có hiệu lực.`}
      </SessionCopy>
    );
  return (
    <>
      <SessionCopy>Lịch đề xuất · Bản {snapshot.version}</SessionCopy>
      <SessionCopy>
        {formatSessionTime(snapshot.item.startAt, timezone)} —{" "}
        {formatSessionTime(snapshot.item.endAt, timezone)}
      </SessionCopy>
      <SessionCopy>
        Bạn: {snapshot.ownConfirmed ? "Đã xác nhận" : "Chưa xác nhận"}
      </SessionCopy>
      <SessionCopy>
        Đối tác: {snapshot.partnerConfirmed ? "Đã xác nhận" : "Chưa xác nhận"}
      </SessionCopy>
      <SessionCopy muted>
        Lịch cũ vẫn có hiệu lực đến khi hệ thống chốt lịch mới.
      </SessionCopy>
    </>
  );
}
