"use client";
import { formText } from "../components/form-data";

import { useState } from "react";
import type { LearningPath, LearningSession } from "../types";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback, formatTime } from "../components/common";
import { vietnamInstant } from "./session-policy";
export function SessionReschedule({
  session,
  path,
}: Readonly<{ session: LearningSession; path: LearningPath }>) {
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
        : schedule.participantBConfirmedAt;
  return (
    <div className="learner-stack">
      {pending ? (
        <>
          <p>
            Lịch đề xuất đang chờ:{" "}
            {schedule.items.map((item) => formatTime(item.startAt)).join(", ")}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!!ownConfirmed || command.pending || command.uncertain}
            onClick={() => {
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
              : "Xác nhận lịch đề xuất"}
          </button>
        </>
      ) : (
        <form
          className="learner-form"
          onSubmit={(event) => {
            event.preventDefault();
            setError(undefined);
            const values = new FormData(event.currentTarget);
            try {
              const startAt = vietnamInstant(formText(values, "start")),
                duration = Number(values.get("duration"));
              if (
                Date.parse(startAt) <= Date.now() ||
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
            <span>Giờ mới (giờ Việt Nam)</span>
            <input name="start" type="datetime-local" required />
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
            />
          </label>
          <button
            type="submit"
            className="btn"
            disabled={command.pending || command.uncertain}
          >
            Gửi đề nghị lịch mới
          </button>
        </form>
      )}
      {error && <p className="learner-error">{error}</p>}
      <CommandFeedback command={command} />
    </div>
  );
}
