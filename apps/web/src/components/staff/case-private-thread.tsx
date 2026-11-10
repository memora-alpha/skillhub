"use client";
import { useRef, useState } from "react";
import { useStaffList, useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { DownloadButton, Pager, QueueState } from "./common";
import { useOperation } from "./operation-tools";
import { fmtDateTime, fmtSize } from "@/lib/console/format";
export function PrivateThread({
  caseId,
  partyId,
  readOnly = false,
}: Readonly<{ caseId: string; partyId: string; readOnly?: boolean }>) {
  const { api, actor } = useStaffSession();
  const base = `reports/support/cases/${caseId}/parties/${partyId}`;
  const messages = useStaffList<{
    id: string;
    text: string;
    senderId: string;
    createdAt: string;
  }>(`${base}/messages?limit=30`);
  const files = useStaffResource<
    {
      id: string;
      mimeType: string;
      fileSizeBytes: string;
      uploadedAt: string;
    }[]
  >(`${base}/evidence`);
  const [text, setText] = useState("");
  const operation = useOperation();
  const attempt = useRef<{ text: string; id: string } | null>(null);
  return (
    <section>
      <button
        type="button"
        className="btn"
        onClick={() => {
          void messages.reload();
          void files.reload();
        }}
      >
        Làm mới trao đổi
      </button>
      <QueueState
        loading={messages.loading}
        error={messages.error}
        empty={false}
        reload={messages.reload}
      >
        {messages.items.length === 0 && !messages.loading && (
          <p>Chưa có tin nhắn.</p>
        )}
        <ol>
          {messages.items.map((m) => (
            <li key={m.id}>
              <strong>
                {m.senderId === actor?.userId ? "Bạn" : "Người dùng"}
              </strong>{" "}
              · <small>{fmtDateTime(m.createdAt)}</small>
              <p style={{ whiteSpace: "pre-wrap" }}>{m.text}</p>
            </li>
          ))}
        </ol>
      </QueueState>
      <Pager
        loading={messages.loading}
        more={messages.more}
        hasMore={messages.page?.hasMore}
      />
      {readOnly && (
        <p className="muted">
          Vụ việc đã kết thúc. Bạn có thể xem lịch sử trao đổi.
        </p>
      )}
      {!readOnly && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void operation.run(async () => {
              const content = text.trim();
              if (attempt.current?.text !== content)
                attempt.current = { text: content, id: crypto.randomUUID() };
              await api(`${base}/messages`, {
                method: "POST",
                body: { clientMessageId: attempt.current.id, text: content },
              });
              attempt.current = null;
              setText("");
              await messages.reload();
            });
          }}
        >
          <label>
            <span>Tin nhắn riêng</span>
            <textarea
              required
              maxLength={4000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={operation.busy}
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={operation.busy || !text.trim()}
          >
            Gửi
          </button>
        </form>
      )}
      {operation.feedback}
      <details>
        <summary>Bằng chứng riêng</summary>
        <QueueState
          loading={files.loading}
          error={files.error}
          empty={!files.data?.length}
          reload={files.reload}
        >
          {files.data?.map((f, i) => (
            <div key={f.id}>
              <p>
                {f.mimeType} · {fmtSize(Number(f.fileSizeBytes))}
              </p>
              <DownloadButton
                path={`${base}/evidence/${f.id}/download`}
                name={`Bằng chứng ${i + 1}`}
              />
            </div>
          ))}
        </QueueState>
      </details>
    </section>
  );
}
