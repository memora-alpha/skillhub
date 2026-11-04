"use client";
import { formText } from "../components/form-data";

import { useState } from "react";
import type { Plan, ScheduleItem } from "../types";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback } from "../components/common";
import { vietnamInstant } from "../sessions/session-policy";
const local = (date: string) =>
  new Date(Date.parse(date) + 7 * 3600000).toISOString().slice(0, 16);
export function ScheduleEditor({
  plan,
  onSaved,
}: Readonly<{ plan: Plan; onSaved: () => void }>) {
  const { request } = useUserSession(),
    command = useUserCommand(),
    [error, setError] = useState<string>();
  return (
    <form
      className="learner-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(undefined);
        const values = new FormData(event.currentTarget);
        try {
          const items: ScheduleItem[] = Array.from(
            { length: plan.totalSessions },
            (_, index) => {
              const start = formText(values, "start-" + index),
                duration = Number(values.get("duration-" + index)),
                old = plan.schedule?.items.find(
                  (item) => item.sessionNo === index + 1,
                );
              const startAt =
                old && local(old.startAt) === start
                  ? old.startAt
                  : vietnamInstant(start);
              if (
                Date.parse(startAt) <= Date.now() ||
                !Number.isInteger(duration) ||
                duration < 60 ||
                duration > 180
              )
                throw new Error(
                  "Mỗi buổi cần ở tương lai, dài từ 60 đến 180 phút.",
                );
              const endAt =
                old?.startAt === startAt &&
                (Date.parse(old.endAt) - Date.parse(old.startAt)) / 60000 ===
                  duration
                  ? old.endAt
                  : new Date(
                      Date.parse(startAt) + duration * 60000,
                    ).toISOString();
              return { sessionNo: index + 1, startAt, endAt };
            },
          );
          if (
            items.some((item, index) =>
              items.some(
                (other, second) =>
                  second > index &&
                  Date.parse(item.startAt) < Date.parse(other.endAt) &&
                  Date.parse(item.endAt) > Date.parse(other.startAt),
              ),
            )
          )
            throw new Error("Các buổi trong kế hoạch đang bị trùng giờ.");
          const body = plan.schedule
            ? { expectedVersion: plan.schedule.version, items }
            : { expectedPlanVersion: plan.version, items };
          const result = await command.run(JSON.stringify(body), () =>
            request(
              plan.schedule
                ? "schedule-proposals/" + plan.schedule.id
                : "learning-plans/" + plan.id + "/schedule-proposals",
              { method: plan.schedule ? "PATCH" : "POST", body },
            ),
          );
          if (result) onSaved();
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : "Lịch chưa hợp lệ.",
          );
        }
      }}
    >
      <p className="muted">
        Nhập giờ Việt Nam. Đối tác cần xác nhận cùng phiên bản trước khi chốt
        lịch.
      </p>
      {Array.from({ length: plan.totalSessions }, (_, index) => {
        const old = plan.schedule?.items.find(
          (item) => item.sessionNo === index + 1,
        );
        return (
          <fieldset key={index} className="learner-picker">
            <legend>Buổi {index + 1}</legend>
            <div className="learner-form-grid">
              <label>
                <span>Bắt đầu</span>
                <input
                  type="datetime-local"
                  name={"start-" + index}
                  defaultValue={old ? local(old.startAt) : undefined}
                  required
                  disabled={command.pending || command.uncertain}
                />
              </label>
              <label>
                <span>Thời lượng (phút)</span>
                <input
                  type="number"
                  name={"duration-" + index}
                  defaultValue={
                    old
                      ? (Date.parse(old.endAt) - Date.parse(old.startAt)) /
                        60000
                      : 60
                  }
                  min={60}
                  max={180}
                  step={1}
                  required
                  disabled={command.pending || command.uncertain}
                />
              </label>
            </div>
          </fieldset>
        );
      })}
      {error && (
        <p className="learner-error" role="alert">
          {error}
        </p>
      )}
      <CommandFeedback command={command} />
      <button
        type="submit"
        className="btn btn-primary"
        disabled={command.pending || command.uncertain}
      >
        Gửi lịch để hai bên xác nhận
      </button>
    </form>
  );
}
