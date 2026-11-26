"use client";
import { LoadingButton } from "@/components/loading-button";
import { systemCodeLabel } from "@/lib/system-text";
import { useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import {
  CommandFeedback,
  Feedback,
  Panel,
  formatTime,
} from "../components/common";
import { changeLabels, type LearningChange } from "./post-session-contract";
import { UserApiError } from "../api/client";
import { TerminationPreview } from "./termination-preview";

export function LearningChangePanel({
  pathId,
  sessionId,
  startAt,
  canRequest,
  blocked = false,
}: Readonly<{
  pathId: string;
  sessionId?: string;
  startAt?: string;
  canRequest: boolean;
  blocked?: boolean;
}>) {
  const endpoint = sessionId
    ? `sessions/${sessionId}/cancellation-requests`
    : `learning-paths/${pathId}/termination-requests`;
  const query = useUserResource<LearningChange[]>(endpoint);
  const { actor, request } = useUserSession();
  const create = useUserCommand(true),
    decision = useUserCommand();
  const [reason, setReason] = useState("");
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState("");
  const [escalateReason, setEscalateReason] = useState("");
  const submitted = useRef<{ reason: string; expectedStartAt?: string } | null>(
    null,
  );
  const open = query.data?.some((r) =>
    ["PENDING", "ACCEPTED", "STAFF_REVIEW"].includes(r.status),
  );
  const disabled =
    blocked ||
    query.loading ||
    !!query.error ||
    create.pending ||
    create.uncertain ||
    decision.pending ||
    decision.uncertain;
  async function send() {
    const body = submitted.current ?? {
      reason: reason.trim(),
      ...(sessionId ? { expectedStartAt: startAt } : {}),
    };
    submitted.current = body;
    const receipt = await create.run(
      JSON.stringify({ endpoint, body }),
      async (key) => {
        const reply = await request<LearningChange>(endpoint, {
          method: "POST",
          body,
          key,
        });
        if (!reply.data?.id || reply.data.pathId !== pathId)
          throw new UserApiError(502, "API_RESPONSE_INVALID");
        return reply;
      },
    );
    if (receipt) {
      submitted.current = null;
      setReason("");
      setComposing(false);
    }
    query.reload();
  }
  async function act(
    row: LearningChange,
    action: "response" | "withdraw" | "escalate",
    accept?: boolean,
  ) {
    const body = {
      expectedVersion: row.version,
      ...(action === "response" ? { accept, note: note.trim() } : {}),
      ...(action === "escalate" ? { reason: escalateReason.trim() } : {}),
    };
    const result = await decision.run(
      JSON.stringify({ id: row.id, action, body }),
      () =>
        request(endpoint + "/" + row.id + "/" + action, {
          method: "POST",
          body,
        }),
    );
    if (result) {
      if (action === "response") setNote("");
      if (action === "escalate") setEscalateReason("");
    }
    query.reload();
  }
  if (!canRequest && query.data?.length === 0 && !query.error) return null;
  return (
    <Panel title={sessionId ? "Hủy buổi để học bù" : "Yêu cầu dừng lộ trình"}>
      {(composing || open) && (
        <p>
          {sessionId
            ? "Hai bên cần đồng ý trước giờ học. Người yêu cầu dùng một lượt học bù; Credit giữ nguyên. Sau đó cần chốt lịch bù."
            : "Lịch học tiếp tục đến khi yêu cầu được duyệt. Credit được xử lý theo quyết định."}
        </p>
      )}
      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />
      {!sessionId && (composing || open) && (
        <TerminationPreview pathId={pathId} />
      )}
      {!open && canRequest && !composing && !create.uncertain && (
        <LoadingButton
          type="button"
          className="btn"
          disabled={disabled}
          onClick={() => setComposing(true)}
          loading={!!(query.loading || create.pending || decision.pending)}
        >
          {sessionId ? "Yêu cầu hủy buổi" : "Yêu cầu dừng lộ trình"}
        </LoadingButton>
      )}
      {!open && canRequest && (composing || create.uncertain) && (
        <form
          className="learner-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label>
            <span>Lý do yêu cầu</span>
            <textarea
              minLength={3}
              maxLength={1000}
              required
              value={reason}
              disabled={disabled}
              onChange={(e) => {
                submitted.current = null;
                setReason(e.target.value);
              }}
            />
          </label>
          <LoadingButton
            type="submit"
            className="btn"
            disabled={disabled || !query.data}
            loading={!!(query.loading || create.pending || decision.pending)}
          >
            Gửi yêu cầu cho đối tác
          </LoadingButton>
          {!create.pending && !create.uncertain && (
            <button
              type="button"
              className="btn"
              onClick={() => setComposing(false)}
            >
              Đóng
            </button>
          )}
        </form>
      )}
      {create.canRetry && (
        <LoadingButton
          type="button"
          className="btn"
          disabled={create.pending}
          onClick={() => void send()}
          loading={!!create.pending}
        >
          Kiểm tra lại cùng yêu cầu đã gửi
        </LoadingButton>
      )}
      {query.data?.map((row) => (
        <article key={row.id}>
          <h3>{changeLabels[row.status] ?? systemCodeLabel(row.status)}</h3>
          <p className="learner-prose">{row.reason}</p>
          <p className="muted">
            Gửi: {formatTime(row.createdAt)} · Hạn phản hồi:{" "}
            {formatTime(row.expiresAt)}
          </p>
          {row.responseNote && <p>Phản hồi: {row.responseNote}</p>}
          {row.blockedByDispute && (
            <p className="learner-notice">
              Đang có tranh chấp. Quyết định chưa thể được áp dụng.
            </p>
          )}
          {row.awaitingPolicy && (
            <p className="learner-notice">
              Chờ chính sách phân bổ Credit được duyệt trước khi thực thi.
            </p>
          )}
          {row.resolution?.creditPenalty && (
            <p>
              Khoản phạt Credit theo quyết định: {row.resolution.creditPenalty}
            </p>
          )}
          {row.status === "PENDING" && (
            <>
              {row.requesterId === actor.userId ? (
                <LoadingButton
                  type="button"
                  className="btn"
                  disabled={disabled}
                  onClick={() => void act(row, "withdraw")}
                  loading={
                    !!(query.loading || create.pending || decision.pending)
                  }
                >
                  Rút yêu cầu này
                </LoadingButton>
              ) : (
                <>
                  <label>
                    <span>Ghi chú phản hồi (không bắt buộc)</span>
                    <textarea
                      maxLength={1000}
                      value={note}
                      disabled={disabled}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <div className="learner-actions">
                    <LoadingButton
                      type="button"
                      className="btn"
                      disabled={disabled}
                      onClick={() => void act(row, "response", true)}
                      loading={
                        !!(query.loading || create.pending || decision.pending)
                      }
                    >
                      Đồng ý yêu cầu
                    </LoadingButton>
                    <LoadingButton
                      type="button"
                      className="btn"
                      disabled={disabled}
                      onClick={() => void act(row, "response", false)}
                      loading={
                        !!(query.loading || create.pending || decision.pending)
                      }
                    >
                      Từ chối
                    </LoadingButton>
                  </div>
                </>
              )}
            </>
          )}
          {["ACCEPTED", "STAFF_REVIEW"].includes(row.status) &&
            !row.approvedAt &&
            row.requesterId === actor.userId && (
              <LoadingButton
                type="button"
                className="btn"
                disabled={disabled}
                onClick={() => void act(row, "withdraw")}
                loading={
                  !!(query.loading || create.pending || decision.pending)
                }
              >
                Rút yêu cầu chưa thực thi
              </LoadingButton>
            )}
          {!sessionId &&
            !row.approvedAt &&
            ["PENDING", "ACCEPTED"].includes(row.status) && (
              <div className="learner-form">
                <label>
                  <span>Lý do cần nhân sự hỗ trợ</span>
                  <textarea
                    value={escalateReason}
                    maxLength={1000}
                    disabled={disabled}
                    onChange={(e) => setEscalateReason(e.target.value)}
                  />
                </label>
                <LoadingButton
                  type="button"
                  className="btn"
                  disabled={disabled || escalateReason.trim().length < 3}
                  onClick={() => void act(row, "escalate")}
                  loading={
                    !!(query.loading || create.pending || decision.pending)
                  }
                >
                  Chuyển nhân sự xem xét
                </LoadingButton>
              </div>
            )}
        </article>
      ))}
      {decision.uncertain && (
        <p>
          Chưa xác định kết quả phản hồi. Tải lại lịch sử trước khi thực hiện
          thao tác tiếp.
        </p>
      )}
      <CommandFeedback command={create} />
      <CommandFeedback command={decision} />
      <LoadingButton
        type="button"
        className="btn"
        disabled={query.loading || create.pending || decision.pending}
        onClick={() => query.reload()}
        loading={!!(query.loading || create.pending || decision.pending)}
      >
        Làm mới
      </LoadingButton>
    </Panel>
  );
}
