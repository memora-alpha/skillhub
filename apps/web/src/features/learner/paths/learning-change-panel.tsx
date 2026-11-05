"use client";
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
      ...(action === "escalate" ? { reason: note.trim() } : {}),
    };
    await decision.run(JSON.stringify({ id: row.id, action, body }), () =>
      request(endpoint + "/" + row.id + "/" + action, { method: "POST", body }),
    );
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
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {!open && canRequest && !composing && !create.uncertain && (
        <button
          type="button"
          className="btn"
          disabled={disabled}
          onClick={() => setComposing(true)}
        >
          {sessionId ? "Yêu cầu hủy buổi" : "Yêu cầu dừng lộ trình"}
        </button>
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
          <button
            type="submit"
            className="btn"
            disabled={disabled || !query.data}
          >
            Gửi yêu cầu cho đối tác
          </button>
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
        <button
          type="button"
          className="btn"
          disabled={create.pending}
          onClick={() => void send()}
        >
          Kiểm tra lại cùng yêu cầu đã gửi
        </button>
      )}
      {query.data?.map((row) => (
        <article key={row.id}>
          <h3>{changeLabels[row.status] ?? row.status}</h3>
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
                <button
                  type="button"
                  className="btn"
                  disabled={disabled}
                  onClick={() => void act(row, "withdraw")}
                >
                  Rút yêu cầu này
                </button>
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
                    <button
                      type="button"
                      className="btn"
                      disabled={disabled}
                      onClick={() => void act(row, "response", true)}
                    >
                      Đồng ý yêu cầu
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={disabled}
                      onClick={() => void act(row, "response", false)}
                    >
                      Từ chối
                    </button>
                  </div>
                </>
              )}
            </>
          )}
          {["ACCEPTED", "STAFF_REVIEW"].includes(row.status) &&
            row.requesterId === actor.userId && (
              <button
                type="button"
                className="btn"
                disabled={disabled}
                onClick={() => void act(row, "withdraw")}
              >
                Rút yêu cầu chưa thực thi
              </button>
            )}
          {!sessionId && ["PENDING", "ACCEPTED"].includes(row.status) && (
            <div className="learner-form">
              <label>
                <span>Lý do cần nhân sự hỗ trợ</span>
                <textarea
                  value={note}
                  maxLength={1000}
                  disabled={disabled}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn"
                disabled={disabled || note.trim().length < 3}
                onClick={() => void act(row, "escalate")}
              >
                Chuyển nhân sự xem xét
              </button>
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
      <button
        type="button"
        className="btn"
        disabled={query.loading || create.pending || decision.pending}
        onClick={() => query.reload()}
      >
        Làm mới
      </button>
    </Panel>
  );
}
