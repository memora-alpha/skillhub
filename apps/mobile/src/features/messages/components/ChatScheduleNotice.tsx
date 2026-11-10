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
  if (notice.confirmation) {
    const value = notice.confirmation;
    const teaching = cardProps.mine
      ? value.confirmedBy === value.teacherId
      : value.confirmedBy !== value.teacherId;
    return (
      <ChatWorkflowCard
        {...cardProps}
        label={teaching ? "Lịch bạn dạy" : "Lịch bạn học"}
        title={value.title}
        summary={
          value.bothConfirmed
            ? "Hai bên đã đồng ý lịch này · Chưa chốt lịch."
            : `${cardProps.mine ? "Bạn" : cardProps.partner} đã đồng ý · Chờ ${cardProps.mine ? "đối tác" : "bạn"} xác nhận.`
        }
        version={value.version}
        expandSummary
        confirmed={value.bothConfirmed}
        badgeLabel={value.bothConfirmed ? "Đủ xác nhận" : "Chờ xác nhận"}
        action="Xem lịch học"
        actionText="Xem lịch học"
      />
    );
  }
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
