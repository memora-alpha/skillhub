import { FormNotice } from "@/components/FormNotice";
import { useSessionContext } from "../hooks/use-session-context";
import { useSessionsRuntime } from "../runtime";
import type { LearningSession } from "../types";
import { rescheduleSnapshot } from "../utils/reschedule-snapshot";
import { formatSessionTime } from "../utils/session-time";
import { SessionPanel, SessionCopy } from "./session-page";

export function RescheduleProposalPanel({
  session,
  timezone,
}: Readonly<{
  session: LearningSession;
  timezone: string;
}>) {
  const query = useSessionContext(session),
    { userId } = useSessionsRuntime();
  const snapshot = query.context
    ? rescheduleSnapshot(session, query.context, userId)
    : undefined;
  return (
    <SessionPanel title="Đề nghị đổi lịch hiện tại">
      <ProposalContent
        snapshot={snapshot}
        timezone={timezone}
        loading={query.isLoading}
      />
      {!!query.error && (
        <FormNotice tone="error">
          Chưa tải lại được đề nghị. Thông tin đang hiển thị có thể chưa cập
          nhật. Kéo xuống để thử lại.
        </FormNotice>
      )}
      <FormNotice tone="info">
        Gửi và xác nhận đổi lịch chưa khả dụng. Lịch hiện tại vẫn có hiệu lực.
      </FormNotice>
    </SessionPanel>
  );
}

function ProposalContent({
  snapshot,
  timezone,
  loading,
}: Readonly<{
  snapshot: ReturnType<typeof rescheduleSnapshot>;
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
        Buổi học này chưa có lịch mới đang chờ xác nhận. Lịch bản{" "}
        {snapshot.appliedVersion} đang có hiệu lực.
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
