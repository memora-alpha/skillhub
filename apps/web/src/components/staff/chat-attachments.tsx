"use client";
import { LoadingButton } from "@/components/loading-button";
import { Badge, Card, PageHeader } from "@/components/console/ui";
import { Icon } from "@/components/console/icon";
import { hasPermission } from "@/lib/staff/permissions";
import { useCallback, useEffect, useState } from "react";
import { DecisionDialog, QueueState } from "./common";
import { useStaffSession } from "./session";
import { isSessionFailure } from "@/lib/staff/client";

type ChatAttachmentQueueItem = {
  fileId: string;
  messageId: string;
  conversationId: string;
  uploaderId: string;
  mimeType: string;
  outcome: "BLOCK" | "REVIEW" | "FAILED";
  reasonCodes: string[] | null;
};

type ChatAttachmentQueueResponse = {
  items: ChatAttachmentQueueItem[];
  nextCursor: string | null;
};

function outcomeTone(outcome: ChatAttachmentQueueItem["outcome"]) {
  if (outcome === "BLOCK") return "bad" as const;
  if (outcome === "REVIEW") return "warn" as const;
  return "neutral" as const;
}

function outcomeLabel(outcome: ChatAttachmentQueueItem["outcome"]) {
  if (outcome === "BLOCK") return "Đã chặn / thu hồi";
  if (outcome === "REVIEW") return "Cần kiểm duyệt";
  return "Quét lỗi";
}

export function ChatAttachmentsModerationScreen() {
  const { actor, api, expire } = useStaffSession();
  const canModerate = hasPermission(actor, "chat-attachment:moderate");
  const [items, setItems] = useState<ChatAttachmentQueueItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(canModerate);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const [revoking, setRevoking] = useState<ChatAttachmentQueueItem | null>(
    null,
  );
  const [notice, setNotice] = useState<string>();

  const loadPage = useCallback(
    async (before?: string | null) => {
      if (!canModerate) return;
      if (before) setLoadingMore(true);
      else setLoading(true);
      setError(undefined);
      try {
        const query = before ? `?before=${encodeURIComponent(before)}` : "";
        const res = await api<ChatAttachmentQueueResponse>(
          `content-moderation/chat-attachments${query}`,
        );
        setItems((prev) =>
          before
            ? [
                ...prev,
                ...res.data.items.filter(
                  (row) => !prev.some((old) => old.fileId === row.fileId),
                ),
              ]
            : res.data.items,
        );
        setNextCursor(res.data.nextCursor);
      } catch (cause) {
        if (isSessionFailure(cause)) expire();
        setError(
          cause instanceof Error
            ? cause.message
            : "Chưa tải được hàng đợi tệp tin nhắn.",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [api, canModerate, expire],
  );

  useEffect(() => {
    if (!canModerate) return;
    let cancelled = false;
    void api<ChatAttachmentQueueResponse>("content-moderation/chat-attachments")
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.items);
        setNextCursor(res.data.nextCursor);
        setError(undefined);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (isSessionFailure(cause)) expire();
        setError(
          cause instanceof Error
            ? cause.message
            : "Chưa tải được hàng đợi tệp tin nhắn.",
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, canModerate, expire]);

  if (!canModerate) {
    return (
      <section className="ops-page">
        <PageHeader
          title="Kiểm duyệt tệp đính kèm tin nhắn"
          desc="Tài khoản chưa được cấp quyền chat-attachment:moderate."
        />
        <Card>
          <p className="muted">
            Liên hệ quản trị viên để được cấp quyền kiểm duyệt tệp tin nhắn.
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section className="ops-page">
      <PageHeader
        title="Kiểm duyệt tệp đính kèm tin nhắn"
        desc="Xem các tệp chat bị gắn cờ kiểm duyệt hoặc quét lỗi và thu hồi quyền tải khi xác nhận vi phạm."
        actions={
          <LoadingButton
            type="button"
            className="btn"
            loading={loading}
            onClick={() => void loadPage()}
          >
            <Icon name="refresh" size={15} />
            Làm mới
          </LoadingButton>
        }
      />

      {notice && (
        <output className="staff-success" role="status">
          {notice}
        </output>
      )}

      <Card>
        <QueueState
          loading={loading}
          error={error}
          empty={!items.length}
          reload={() => void loadPage()}
          emptyTitle="Không có tệp tin nhắn bị gắn cờ"
          emptyDescription="Hiện chưa có tệp đính kèm chat nào ở trạng thái BLOCK, REVIEW hoặc FAILED."
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tệp / Định dạng</th>
                  <th>Trạng thái</th>
                  <th>Mã lý do</th>
                  <th>Cuộc trò chuyện / Tin nhắn</th>
                  <th>Người tải lên</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.fileId}>
                    <td>
                      <div>
                        <code>{item.fileId}</code>
                      </div>
                      <small className="muted">{item.mimeType || "—"}</small>
                    </td>
                    <td>
                      <Badge tone={outcomeTone(item.outcome)}>
                        {outcomeLabel(item.outcome)}
                      </Badge>
                    </td>
                    <td>
                      {item.reasonCodes?.length ? (
                        <div
                          className="row"
                          style={{ gap: 4, flexWrap: "wrap" }}
                        >
                          {item.reasonCodes.map((code) => (
                            <Badge key={code} tone="neutral">
                              {code}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div>
                        <small className="muted">Chat: </small>
                        <code>{item.conversationId.slice(0, 8)}</code>
                      </div>
                      <div>
                        <small className="muted">Msg: </small>
                        <code>{item.messageId.slice(0, 8)}</code>
                      </div>
                    </td>
                    <td>
                      <code>{item.uploaderId.slice(0, 8)}</code>
                    </td>
                    <td>
                      {item.outcome === "BLOCK" ? (
                        <span className="muted">Đã thu hồi</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => {
                            setNotice(undefined);
                            setRevoking(item);
                          }}
                        >
                          Thu hồi tải xuống
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nextCursor && (
            <div className="staff-pager">
              <LoadingButton
                type="button"
                className="btn"
                loading={loadingMore}
                onClick={() => void loadPage(nextCursor)}
              >
                {loadingMore ? "Đang tải…" : "Tải thêm"}
              </LoadingButton>
            </div>
          )}
        </QueueState>
      </Card>

      {revoking && (
        <DecisionDialog
          title="Thu hồi quyền tải tệp đính kèm"
          description={`Tệp ${revoking.fileId} (${revoking.mimeType}) sẽ bị chuyển sang trạng thái BLOCK/REVOKED và hai bên không thể tải xuống nữa.`}
          label="Lý do thu hồi (lưu nhật ký kiểm duyệt)"
          min={1}
          max={500}
          confirmLabel="Xác nhận thu hồi"
          danger
          onClose={() => setRevoking(null)}
          onReload={() => void loadPage()}
          onSubmit={async (reason) => {
            await api(
              `content-moderation/chat-attachments/${revoking.fileId}/revoke`,
              {
                method: "POST",
                body: { reason: reason.trim() },
              },
            );
            setItems((prev) =>
              prev.map((row) =>
                row.fileId === revoking.fileId
                  ? {
                      ...row,
                      outcome: "BLOCK",
                      reasonCodes: ["STAFF_CONFIRMED"],
                    }
                  : row,
              ),
            );
            setNotice(`Đã thu hồi quyền tải tệp ${revoking.fileId}.`);
            setRevoking(null);
          }}
        />
      )}
    </section>
  );
}
