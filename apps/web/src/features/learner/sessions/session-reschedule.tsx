"use client";
import { formText } from "../components/form-data";

import { useState } from "react";
import type { LearningPath, LearningSession } from "../types";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback, formatTime } from "../components/common";
import { vietnamInstant } from "./session-policy";
import styles from "./session-detail.module.css";
export function SessionReschedule({
  session,
  path,
  disabled = false,
}: Readonly<{
  session: LearningSession;
  path: LearningPath;
  disabled?: boolean;
}>) {
  const { request, actor } = useUserSession(),
    command = useUserCommand(),
    [error, setError] = useState<string>();
  const schedule = path.plans.find(
    (plan) => plan.id === session.planId,
  )?.schedule;
  if (schedule?.appliedVersion == null)
    return (
      <p className="learner-notice">
        Chưa đọc được phiên bản lịch hiện tại. Tải lại lộ trình trước khi thao
        tác.
      </p>
    );
  const pending = schedule.version > schedule.appliedVersion,
    ownConfirmed =
      actor.userId === path.participantAId
        ? schedule.participantAConfirmedAt
        : schedule.participantBConfirmedAt,
    partnerConfirmed =
      actor.userId === path.participantAId
        ? schedule.participantBConfirmedAt
        : schedule.participantAConfirmedAt;
  const makeup = session.status === "MAKEUP_REQUIRED";
  const blocked =
    disabled ||
    command.pending ||
    command.uncertain ||
    !["SCHEDULED", "ACTIVE"].includes(path.status) ||
    (makeup && !session.allowedActions?.includes("PROPOSE_MAKEUP"));
  const sessionNo =
    session.outlineSessionNo ??
    path.plans
      .find((plan) => plan.id === session.planId)
      ?.sessions.find((item) => item.id === session.id)?.sessionNo;
  function checkDeadline() {
    if (
      makeup &&
      session.deadlines?.makeupBy &&
      Date.now() >= Date.parse(session.deadlines.makeupBy)
    )
      throw new Error(
        "Đã hết hạn chốt lịch học bù. Tải lại buổi học để xem hướng xử lý.",
      );
  }
  return (
    <div className="learner-stack">
      {pending ? (
        <>
          <div className={styles.inset}>
            <strong>Lịch đề xuất đang chờ hai bên xác nhận</strong>
            <p>
              Xác nhận áp dụng cho toàn bộ phiên bản lịch bên dưới. Kiểm tra
              thời gian trước khi đồng ý.
            </p>
            <ul className={styles.proposedTimes}>
              {schedule.items.map((item) => (
                <li key={item.sessionNo}>
                  <strong>
                    Buổi {item.sessionNo}
                    {item.sessionNo === sessionNo ? " · Buổi đang xem" : ""}
                  </strong>
                  <span>
                    {formatTime(item.startAt)} – {formatTime(item.endAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <dl
            className={styles.confirmations}
            aria-label="Tiến trình xác nhận lịch mới"
          >
            <div>
              <dt>Bạn</dt>
              <dd>{ownConfirmed ? "Đã xác nhận" : "Chưa xác nhận"}</dd>
            </div>
            <div>
              <dt>Đối tác</dt>
              <dd>{partnerConfirmed ? "Đã xác nhận" : "Chưa xác nhận"}</dd>
            </div>
          </dl>
          <p className="muted" role="status">
            {ownConfirmed && partnerConfirmed
              ? "Hai bên đã xác nhận. Đang chờ máy chủ áp dụng lịch mới."
              : ownConfirmed
                ? "Bạn đã xác nhận. Chờ đối tác xác nhận để áp dụng lịch mới; trang sẽ tự cập nhật."
                : "Bạn cần xác nhận phiên bản lịch này, kể cả khi bạn là người gửi đề xuất."}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!!ownConfirmed || blocked}
            onClick={() => {
              if (blocked) return;
              setError(undefined);
              try {
                checkDeadline();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Không thể xác nhận lịch.",
                );
                return;
              }
              void command.run(
                "confirm:" + schedule.id + ":" + schedule.version,
                () =>
                  request("schedule-proposals/" + schedule.id + "/confirm", {
                    method: "POST",
                    body: { expectedVersion: schedule.version },
                  }),
              );
            }}
          >
            {ownConfirmed
              ? "Đã xác nhận · chờ đối tác"
              : command.pending
                ? "Đang xác nhận…"
                : "Xác nhận lịch đề xuất"}
          </button>
        </>
      ) : (
        <form
          className="learner-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (blocked) return;
            setError(undefined);
            const values = new FormData(event.currentTarget);
            try {
              checkDeadline();
              const startAt = vietnamInstant(formText(values, "start")),
                duration = Number(values.get("duration"));
              if (
                Date.parse(startAt) <= Date.now() ||
                !Number.isInteger(duration) ||
                duration < 60 ||
                duration > 180
              )
                throw new Error(
                  "Chọn giờ trong tương lai và thời lượng 60–180 phút.",
                );
              const body = {
                expectedVersion: schedule.version,
                startAt,
                endAt: new Date(
                  Date.parse(startAt) + duration * 60000,
                ).toISOString(),
              };
              void command.run(JSON.stringify(body), () =>
                request("sessions/" + session.id + "/reschedule-proposals", {
                  method: "POST",
                  body,
                }),
              );
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : "Lịch chưa hợp lệ.",
              );
            }
          }}
        >
          <label>
            <span>{makeup ? "Giờ học bù" : "Giờ mới"} (giờ Việt Nam)</span>
            <input
              name="start"
              type="datetime-local"
              required
              disabled={blocked}
            />
          </label>
          <label>
            <span>Thời lượng (phút)</span>
            <input
              name="duration"
              type="number"
              min={60}
              max={180}
              defaultValue={60}
              required
              disabled={blocked}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={blocked}>
            {command.pending
              ? "Đang gửi đề xuất…"
              : makeup
                ? "Gửi đề xuất lịch học bù"
                : "Gửi đề nghị lịch mới"}
          </button>
        </form>
      )}
      {error && <p className="learner-error">{error}</p>}
      <CommandFeedback command={command} />
    </div>
  );
}
