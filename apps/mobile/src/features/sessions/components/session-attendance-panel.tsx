import { useState, useRef } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { DataForm, textRule } from "@/components/data-form";
import { FormNotice } from "@/components/FormNotice";
import { useRefreshLearningPath } from "@/features/learning-paths/state";
import { AppError } from "@/lib/http/errors";
import { useSessionsRuntime } from "../runtime";
import type { LearningSession } from "../types";
import { SessionCopy, SessionButton } from "./session-page";
import { SessionSection, SessionInfoRow } from "./session-section";
import { sessionErrorMessage } from "../utils/session-read";
import { formatSessionTime } from "../utils/session-time";
import { noShowGuidance } from "../utils/attendance-presentation";
import { SessionAttendanceSummary } from "./session-attendance-summary";
import {
  isRescheduleEligible,
  rescheduleAvailabilityMessage,
} from "../utils/reschedule-form";

const excuseLabels = {
  PENDING: "Chờ phản hồi",
  ACCEPTED: "Đã chấp nhận",
  REJECTED: "Không chấp nhận",
  EXPIRED: "Đã hết hạn phản hồi",
};
export function SessionAttendancePanel({
  session,
  now = Date.now(),
  disabled = false,
}: Readonly<{
  session: LearningSession;
  now?: number;
  disabled?: boolean;
}>) {
  const runtime = useSessionsRuntime(),
    cache = useQueryClient(),
    router = useRouter();
  const refreshPath = useRefreshLearningPath();
  const busy = useRef(false);
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState<string>();
  const [error, setError] = useState<unknown>();
  const actions = session.allowedActions ?? [];
  const inWindow =
    !session.deadlines?.excuseOrReportBy ||
    Date.parse(session.deadlines.excuseOrReportBy) > now;
  const allowed = (action: "SUBMIT_EXCUSE" | "DECIDE_EXCUSE") =>
    !disabled && !pending && inWindow && actions.includes(action);
  async function run(
    action: "SUBMIT_EXCUSE" | "DECIDE_EXCUSE",
    work: () => Promise<unknown>,
  ) {
    if (busy.current || !allowed(action)) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const fresh = await runtime.api.detail(session.id);
      if (!fresh.allowedActions?.includes(action))
        throw new AppError("http", 409, "ABSENCE_EXCUSE_NOT_ALLOWED");
      await work();
      if (runtime.isCurrent()) setMessage("Đã ghi nhận phản hồi của bạn.");
    } catch (cause) {
      if (runtime.isCurrent()) setError(cause);
    } finally {
      if (runtime.isCurrent()) {
        await Promise.allSettled([
          cache.invalidateQueries({ queryKey: runtime.key }),
          refreshPath(session.pathId),
        ]);
        setPending(false);
      }
      busy.current = false;
    }
  }
  const ended = Date.parse(session.endAt) <= now;
  const noShowMessage = noShowGuidance(session, now);
  const makeupEligible = isRescheduleEligible(session, now);
  const showAttendance =
    (ended && !!session.attendance && session.status !== "CANCELLED") ||
    !!session.excuse ||
    actions.includes("CONFIRM_COMPLETION") ||
    actions.includes("REPORT_NO_SHOW") ||
    actions.includes("SUBMIT_EXCUSE") ||
    actions.includes("DECIDE_EXCUSE") ||
    session.status === "MAKEUP_REQUIRED" ||
    pending ||
    !!message ||
    !!error;
  const deadlineRows = [
    {
      key: "confirmBy",
      label: "Hạn xác nhận",
      visible: actions.includes("CONFIRM_COMPLETION"),
    },
    {
      key: "excuseOrReportBy",
      label:
        session.attendance?.case === "BOTH_ABSENT"
          ? "Hạn phản hồi"
          : "Hạn giải trình",
      visible:
        !!noShowMessage ||
        actions.includes("SUBMIT_EXCUSE") ||
        actions.includes("DECIDE_EXCUSE") ||
        actions.includes("REPORT_NO_SHOW") ||
        session.excuse?.status === "PENDING",
    },
    {
      key: "makeupBy",
      label: "Hạn chốt lịch học bù",
      visible: session.status === "MAKEUP_REQUIRED",
    },
  ] as const;
  if (!showAttendance) return null;
  return (
    <SessionSection title="Điểm danh buổi học" icon="clipboard">
      {noShowMessage && <SessionCopy muted>{noShowMessage}</SessionCopy>}
      {session.attendance?.state === "PENDING_DATA" && (
        <SessionCopy muted>
          Đang tổng hợp điểm danh. Kéo xuống để cập nhật.
        </SessionCopy>
      )}
      {session.attendance?.state === "UNVERIFIABLE" && (
        <SessionCopy muted>Chưa đủ dữ liệu xác minh điểm danh.</SessionCopy>
      )}
      <SessionAttendanceSummary attendance={session.attendance} />
      {deadlineRows.map(({ key, label, visible }) => {
        const date = session.deadlines?.[key];
        return visible && date ? (
          <SessionCopy key={key} muted>
            {label}: {formatSessionTime(date)}
          </SessionCopy>
        ) : null;
      })}
      {session.excuse && (
        <SessionInfoRow
          label={`Giải trình · ${excuseLabels[session.excuse.status]}`}
        >
          {session.excuse.reason}
        </SessionInfoRow>
      )}
      {message && <FormNotice tone="info">{message}</FormNotice>}
      {!!error && (
        <FormNotice tone="error">{sessionErrorMessage(error)}</FormNotice>
      )}
      {actions.includes("SUBMIT_EXCUSE") && inWindow && (
        <DataForm
          fields={[
            {
              name: "reason",
              label: "Lý do vắng học",
              rule: textRule(10, 1000),
              multiline: true,
            },
          ]}
          disabled={!allowed("SUBMIT_EXCUSE")}
          submitLabel="Gửi giải trình"
          onSubmit={async (values) => {
            await run("SUBMIT_EXCUSE", () =>
              runtime.api.submitExcuse(session.id, values.reason!),
            );
          }}
        />
      )}
      {actions.includes("DECIDE_EXCUSE") && inWindow && (
        <>
          <SessionButton
            disabled={!allowed("DECIDE_EXCUSE")}
            onPress={() => {
              void run("DECIDE_EXCUSE", () =>
                runtime.api.decideExcuse(session.id, true),
              );
            }}
          >
            Chấp nhận lý do và học bù
          </SessionButton>
          <SessionButton
            variant="paper"
            disabled={!allowed("DECIDE_EXCUSE")}
            onPress={() => {
              void run("DECIDE_EXCUSE", () =>
                runtime.api.decideExcuse(session.id, false),
              );
            }}
          >
            Không chấp nhận lý do
          </SessionButton>
        </>
      )}
      {session.status === "MAKEUP_REQUIRED" && (
        <>
          {!makeupEligible && (
            <SessionCopy muted>
              {rescheduleAvailabilityMessage(session, now)}
            </SessionCopy>
          )}
          <SessionButton
            disabled={disabled || pending || !makeupEligible}
            onPress={() => {
              if (!isRescheduleEligible(session)) return;
              router.push(`/learning-sessions/${session.id}/reschedule`);
            }}
          >
            Chọn lịch học bù
          </SessionButton>
        </>
      )}
    </SessionSection>
  );
}
