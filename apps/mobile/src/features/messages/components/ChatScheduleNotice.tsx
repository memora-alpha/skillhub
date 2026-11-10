import type { ComponentProps } from "react";
import { ChatWorkflowCard } from "./ChatWorkflowCard";
import type { ChatScheduleNotice as Notice } from "../utils/schedule-notice";

function confirmationSummary(
  value: NonNullable<Notice["confirmation"]>,
  mine: boolean,
  partner: string,
) {
  if (value.bothConfirmed)
    return "Hai bên đã đồng ý lịch này · Chưa chốt lịch.";
  const confirmedBy = mine ? "Bạn" : partner;
  const waitingFor = mine ? "đối tác" : "bạn";
  return `${confirmedBy} đã đồng ý · Chờ ${waitingFor} xác nhận.`;
}

function scheduleTitle(notice: Notice) {
  if (notice.sessionCount === undefined) return "Đã xác nhận lịch học";
  const readiness = notice.locked ? " đã sẵn sàng" : "";
  return `${notice.sessionCount} buổi học${readiness}.`;
}

function scheduleDateRange(notice: Notice) {
  const date = (value: string) =>
    new Date(value).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  const start = notice.startAt ? date(notice.startAt) : undefined;
  const end = notice.endAt ? date(notice.endAt) : undefined;
  if (!start) return "";
  return start === end ? `Ngày ${start}` : `${start} – ${end}`;
}

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
        summary={confirmationSummary(value, cardProps.mine, cardProps.partner)}
        version={value.version}
        expandSummary
        confirmed={value.bothConfirmed}
        badgeLabel={value.bothConfirmed ? "Đủ xác nhận" : "Chờ xác nhận"}
        action="Xem lịch học"
        actionText="Xem lịch học"
      />
    );
  }
  return (
    <ChatWorkflowCard
      {...cardProps}
      label="Lịch học"
      title={scheduleTitle(notice)}
      summary={scheduleDateRange(notice)}
      confirmed
      badgeLabel={notice.locked ? "Đã chốt" : "Đã xác nhận"}
      action="Xem lịch học"
      actionText="Xem lịch học"
    />
  );
}
