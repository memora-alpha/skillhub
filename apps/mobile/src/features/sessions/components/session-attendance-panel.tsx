import { useState, useRef } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { DataForm, textRule } from "@/components/data-form";
import { FormNotice } from "@/components/FormNotice";
import { useRefreshLearningPath } from "@/features/learning-paths/state";
import { AppError } from "@/lib/http/errors";
import { useSessionsRuntime } from "../runtime";
import type { LearningSession } from "../types";
import { SessionPanel, SessionCopy, SessionButton } from "./session-page";
import { sessionErrorMessage } from "../utils/session-read";
import { AttendanceRules } from "./attendance-rules";
import { attendanceSideText } from "../utils/attendance-presentation";

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
      if (runtime.isCurrent())
        setMessage(
          "Máy chủ đã ghi nhận. Trạng thái mới được tải lại bên dưới.",
        );
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
  return (
    <SessionPanel title="Điểm danh và xử lý buổi học">
      {session.attendance?.state === "PENDING_DATA" && (
        <SessionCopy>
          Máy chủ đang tổng hợp điểm danh. Chưa có số liệu không có nghĩa là đã
          học 0 giây hoặc vắng mặt. Chức năng xác nhận sẽ mở khi máy chủ cho
          phép; kéo xuống để tải lại.
        </SessionCopy>
      )}
      {session.attendance?.state === "UNVERIFIABLE" && (
        <SessionCopy>
          Chưa đủ dữ liệu để xác minh điểm danh. Hệ thống sẽ xử lý theo thời hạn
          và trạng thái buổi học.
        </SessionCopy>
      )}
      {(["teacher", "learner"] as const).map((role) => {
        const side = session.attendance?.[role];
        return (
          side && (
            <SessionCopy key={role}>
              {role === "teacher" ? "Người dạy" : "Người học"}:{" "}
              {attendanceSideText(side)}
              {side.firstJoinedAt
                ? ` · Vào phòng lần đầu: ${new Date(side.firstJoinedAt).toLocaleString("vi-VN")}`
                : ""}
            </SessionCopy>
          )
        );
      })}
      {session.deadlines &&
        Object.entries(session.deadlines).map(
          ([key, date]) =>
            date && (
              <SessionCopy key={key} muted>
                {
                  {
                    confirmBy: "Hạn xác nhận",
                    excuseOrReportBy: "Hạn giải trình vắng học",
                    makeupBy: "Hạn chốt học bù",
                  }[key]
                }
                : {new Date(date).toLocaleString("vi-VN")}
              </SessionCopy>
            ),
        )}
      {session.excuse && (
        <>
          <SessionCopy>Giải trình: {session.excuse.reason}</SessionCopy>
          <SessionCopy>{excuseLabels[session.excuse.status]}</SessionCopy>
        </>
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
      {session.status !== "CANCELLED" && (
        <SessionButton
          variant="paper"
          disabled={disabled || pending}
          onPress={() =>
            router.push({
              pathname: "/reports/new",
              params: { sessionId: session.id, pathId: session.pathId },
            })
          }
        >
          Báo sự cố kỹ thuật / vấn đề khác
        </SessionButton>
      )}
      {session.status === "MAKEUP_REQUIRED" &&
        actions.includes("PROPOSE_MAKEUP") && (
          <SessionButton
            disabled={disabled || pending}
            onPress={() =>
              router.push(`/learning-sessions/${session.id}/reschedule`)
            }
          >
            Đề xuất hoặc xác nhận lịch học bù
          </SessionButton>
        )}
      <AttendanceRules />
    </SessionPanel>
  );
}
