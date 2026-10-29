import type { ComponentProps } from "react";
import { ChatWorkflowCard } from "./ChatWorkflowCard";
import type { ChatScheduleNotice as Notice } from "../utils/schedule-notice";

export function ChatScheduleNotice({
  notice,
  ...cardProps
}: Readonly<
  { notice: Notice } & Pick<
    ComponentProps<typeof ChatWorkflowCard>,
    "mine" | "partner" | "partnerId" | "avatarUrl" | "showAvatar" | "onPress"
  >
>) {
  const date = (value: string) =>
    new Date(value).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  const start = notice.startAt ? date(notice.startAt) : undefined;
  const end = notice.endAt ? date(notice.endAt) : undefined;
  let title = "Đã xác nhận lịch học";
  if (notice.sessionCount !== undefined) {
    const readiness = notice.locked ? " đã sẵn sàng" : "";
    title = `${notice.sessionCount} buổi học${readiness}.`;
  }
  let summary = "";
  if (start) summary = start === end ? `Ngày ${start}` : `${start} – ${end}`;
  return (
    <ChatWorkflowCard
      {...cardProps}
      label="Lịch học"
      title={title}
      summary={summary}
      confirmed
      badgeLabel={notice.locked ? "Đã chốt" : "Đã xác nhận"}
      action="Xem lịch học"
      actionText="Xem lịch học"
    />
  );
}
