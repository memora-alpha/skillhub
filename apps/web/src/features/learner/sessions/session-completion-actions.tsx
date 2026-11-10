"use client";
import { useState } from "react";
import { formText } from "../components/form-data";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback } from "../components/common";
import { UserApiError } from "../api/client";
import type { LearningSession } from "../types";
import styles from "./session-detail.module.css";

const excuseLabels: Record<string, string> = {
  PENDING: "Chờ phản hồi",
  ACCEPTED: "Đã chấp nhận",
  EXPIRED: "Đã hết hạn phản hồi",
  REJECTED: "Không chấp nhận",
};

export function SessionCompletionActions({
  session,
  blocked = false,
}: Readonly<{ session: LearningSession; blocked?: boolean }>) {
  const { request } = useUserSession();
  const command = useUserCommand();
  const [confirm, setConfirm] = useState(false);
  const allowed = session.allowedActions ?? [];
  const disabled = blocked || command.pending || command.uncertain;
  return (
    <div className={styles.forms}>
      {allowed.includes("CONFIRM_COMPLETION") && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!confirm) return;
            void command
              .run("complete:" + session.id, async () => {
                const fresh = (
                  await request<LearningSession>("sessions/" + session.id)
                ).data;
                if (!fresh.allowedActions?.includes("CONFIRM_COMPLETION"))
                  throw new UserApiError(409, "SESSION_CANNOT_BE_COMPLETED");
                return request(
                  "sessions/" + session.id + "/confirm-completion",
                  { method: "POST", body: {} },
                );
              })
              .then((result) => {
                if (result) setConfirm(false);
              });
          }}
        >
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={confirm}
              disabled={disabled}
              onChange={(event) => setConfirm(event.target.checked)}
            />
            <span>Tôi xác nhận đã tham gia buổi học này.</span>
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!confirm || disabled}
          >
            {command.pending ? "Đang xác nhận…" : "Xác nhận đã học"}
          </button>
        </form>
      )}
      {session.excuse && (
        <div className={styles.inset}>
          <strong>Lý do vắng học</strong>
          <p>{session.excuse.reason}</p>
          <span>{excuseLabels[session.excuse.status] ?? "Đang cập nhật"}</span>
        </div>
      )}
      {allowed.includes("SUBMIT_EXCUSE") && (
        <form
          className="learner-form"
          onSubmit={(event) => {
            event.preventDefault();
            const reason = formText(
              new FormData(event.currentTarget),
              "reason",
            ).trim();
            void command.run("excuse:" + session.id + ":" + reason, () =>
              request("sessions/" + session.id + "/absence-excuse", {
                method: "POST",
                body: { reason },
              }),
            );
          }}
        >
          <label>
            <span>Lý do vắng học</span>
            <textarea
              name="reason"
              minLength={10}
              maxLength={1000}
              required
              disabled={disabled}
              rows={4}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={disabled}>
            {command.pending ? "Đang gửi…" : "Gửi giải trình"}
          </button>
        </form>
      )}
      {allowed.includes("DECIDE_EXCUSE") && (
        <div className={styles.decisions}>
          {[true, false].map((accept) => (
            <button
              type="button"
              className={accept ? "btn btn-primary" : "btn"}
              key={String(accept)}
              disabled={disabled}
              onClick={() => {
                void command.run("decide:" + session.id + ":" + accept, () =>
                  request(
                    "sessions/" + session.id + "/absence-excuse/decision",
                    { method: "POST", body: { accept } },
                  ),
                );
              }}
            >
              {accept ? "Chấp nhận và học bù" : "Không chấp nhận lý do"}
            </button>
          ))}
        </div>
      )}
      <CommandFeedback command={command} />
    </div>
  );
}
