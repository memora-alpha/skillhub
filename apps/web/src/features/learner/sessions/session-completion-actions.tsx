"use client";
import { LoadingButton } from "@/components/loading-button";
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
  const [completionNote, setCompletionNote] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
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
              .run(
                "complete:" + session.id + ":" + completionNote,
                async () => {
                  const fresh = (
                    await request<LearningSession>("sessions/" + session.id)
                  ).data;
                  if (!fresh.allowedActions?.includes("CONFIRM_COMPLETION"))
                    throw new UserApiError(409, "SESSION_CANNOT_BE_COMPLETED");
                  return request(
                    "sessions/" + session.id + "/confirm-completion",
                    { method: "POST", body: { note: completionNote.trim() } },
                  );
                },
              )
              .then((result) => {
                if (result) {
                  setConfirm(false);
                  setCompletionNote("");
                }
              });
          }}
        >
          <label>
            Ghi chú hoàn thành (không bắt buộc)
            <textarea
              maxLength={1000}
              value={completionNote}
              disabled={disabled}
              onChange={(event) => setCompletionNote(event.target.value)}
            />
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={confirm}
              disabled={disabled}
              onChange={(event) => setConfirm(event.target.checked)}
            />
            <span>Tôi xác nhận đã tham gia buổi học này.</span>
          </label>
          <LoadingButton
            type="submit"
            className="btn btn-primary"
            disabled={!confirm || disabled}
            loading={!!command.pending}
          >
            {command.pending ? "Đang xác nhận…" : "Xác nhận đã học"}
          </LoadingButton>
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
          <LoadingButton
            type="submit"
            className="btn btn-primary"
            disabled={disabled}
            loading={!!command.pending}
          >
            {command.pending ? "Đang gửi…" : "Gửi giải trình"}
          </LoadingButton>
        </form>
      )}
      {allowed.includes("DECIDE_EXCUSE") && (
        <div className={styles.decisions}>
          <label>
            Ghi chú quyết định (không bắt buộc)
            <textarea
              maxLength={1000}
              value={decisionNote}
              disabled={disabled}
              onChange={(event) => setDecisionNote(event.target.value)}
            />
          </label>
          {[true, false].map((accept) => (
            <LoadingButton
              type="button"
              className={accept ? "btn btn-primary" : "btn"}
              key={String(accept)}
              disabled={disabled}
              onClick={() => {
                void command.run(
                  "decide:" + session.id + ":" + accept + ":" + decisionNote,
                  () =>
                    request(
                      "sessions/" + session.id + "/absence-excuse/decision",
                      {
                        method: "POST",
                        body: { accept, note: decisionNote.trim() },
                      },
                    ),
                );
              }}
              loading={!!command.pending}
            >
              {accept ? "Chấp nhận và học bù" : "Không chấp nhận lý do"}
            </LoadingButton>
          ))}
        </div>
      )}
      <CommandFeedback command={command} />
    </div>
  );
}
