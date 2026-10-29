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
  return (
    <ChatWorkflowCard
      {...cardProps}
      label="Lịch học"
      title={
        notice.sessionCount !== undefined
          ? `${notice.sessionCount} buổi học${notice.locked ? " đã sẵn sàng" : ""}.`
          : "Đã xác nhận lịch học"
      }
      summary={
        start ? (start === end ? `Ngày ${start}` : `${start} – ${end}`) : ""
      }
      confirmed
      badgeLabel={notice.locked ? "Đã chốt" : "Đã xác nhận"}
      action="Xem lịch học"
      actionText="Xem lịch học"
    />
  );
}
