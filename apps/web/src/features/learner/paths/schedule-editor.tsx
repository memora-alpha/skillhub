"use client";
import { LoadingButton } from "@/components/loading-button";
import { formText } from "../components/form-data";
import { useState } from "react";
import type { Plan, ScheduleItem } from "../types";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import { ProfileName } from "../components/profile-name";
import { vietnamInstant } from "../sessions/session-policy";
import styles from "./path-detail.module.css";

const local = (date: string) =>
  new Date(Date.parse(date) + 7 * 3600000).toISOString().slice(0, 16);

export function ScheduleEditor({
  plan,
  onSaved,
}: Readonly<{ plan: Plan; onSaved: () => void }>) {
  const { request } = useUserSession();
  const command = useUserCommand();
  const [error, setError] = useState<string>();
  const outlineBySessionNo = new Map(
    plan.sessionOutline.map((item) => [item.sessionNo, item.content]),
  );
  const disabled = command.pending || command.uncertain;

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
              const start = formText(values, "start-" + index);
              const duration = Number(values.get("duration-" + index));
              const old = plan.schedule?.items.find(
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
          for (const [index, item] of items.entries()) {
            const other = items.find(
              (row, second) =>
                second > index &&
                Date.parse(item.startAt) < Date.parse(row.endAt) &&
                Date.parse(item.endAt) > Date.parse(row.startAt),
            );
            if (other)
              throw new Error(
                "Buổi " +
                  item.sessionNo +
                  " trùng buổi " +
                  other.sessionNo +
                  ". Cả người hướng dẫn và người học của kế hoạch đều bị ảnh hưởng.",
              );
          }
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
      <div className={styles.scheduleGuide}>
        <span>
          <strong>Giờ Việt Nam (GMT+7)</strong> · Mỗi buổi từ 60 đến 180 phút.
          Đối tác cần xác nhận cùng phiên bản trước khi chốt lịch.
        </span>
        <span>
          Hướng dẫn:{" "}
          <strong>
            <ProfileName id={plan.teacherId} />
          </strong>{" "}
          · Học:{" "}
          <strong>
            <ProfileName id={plan.learnerId} />
          </strong>
        </span>
      </div>

      {Array.from({ length: plan.totalSessions }, (_, index) => {
        const old = plan.schedule?.items.find(
          (item) => item.sessionNo === index + 1,
        );
        const topic = outlineBySessionNo.get(index + 1);
        return (
          <fieldset key={index} className={styles.scheduleSlotCard}>
            <legend>Buổi {index + 1}</legend>
            {topic && <p className={styles.scheduleOutlineHint}>{topic}</p>}
            <div className="learner-form-grid">
              <label>
                <span>Thời gian bắt đầu</span>
                <input
                  type="datetime-local"
                  name={"start-" + index}
                  defaultValue={old ? local(old.startAt) : undefined}
                  required
                  disabled={disabled}
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
                  disabled={disabled}
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
      <div className={styles.actionRow}>
        <LoadingButton
          type="submit"
          className="btn btn-primary"
          disabled={disabled}
          loading={!!command.pending}
        >
          <ProductIcon name="calendar" size={16} />
          Gửi lịch để hai bên xác nhận
        </LoadingButton>
      </div>
    </form>
  );
}
