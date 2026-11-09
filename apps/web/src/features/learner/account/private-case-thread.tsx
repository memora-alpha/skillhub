"use client";
import { useCallback, useRef, useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import {
  CommandFeedback,
  Feedback,
  More,
  formatTime,
} from "../components/common";
import { UploadControl } from "../components/upload-control";
import { ReportEvidence } from "./report-evidence";
import { safeDownloadUrl } from "./view-policy";
type Message = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
};
type Evidence = {
  id: string;
  mimeType: string;
  fileSizeBytes: string;
  uploadedAt: string;
};
export function PrivateCaseThread({
  caseId,
  closed = false,
}: Readonly<{ caseId: string; closed?: boolean }>) {
  const { actor } = useUserSession();
  return (
    <CaseThreadContent
      key={`${actor.userId}:${caseId}`}
      caseId={caseId}
      closed={closed}
    />
  );
}
function CaseThreadContent({
  caseId,
  closed = false,
}: Readonly<{ caseId: string; closed?: boolean }>) {
  const { actor, request } = useUserSession();
  const base = `reports/support/cases/${caseId}/parties/${actor.userId}`;
  const messages = useUserList<Message>(base + "/messages?limit=20"),
    evidence = useUserResource<Evidence[]>(base + "/evidence"),
    command = useUserCommand(true),
    fileCommand = useUserCommand(true),
    downloadCommand = useUserCommand(true);
  const [text, setText] = useState(""),
    [file, setFile] = useState<{ id: string; state: string }>(),
    [busy, setBusy] = useState(false),
    [download, setDownload] = useState<string>();
  const pending = useRef<{ clientMessageId: string; text: string } | undefined>(
    undefined,
  );
  const fileState = useCallback(
    (id: string, state: string) =>
      setFile((current) =>
        current?.id === id && current.state !== state ? { id, state } : current,
      ),
    [],
  );
  async function send() {
    const body = pending.current ?? {
      clientMessageId: crypto.randomUUID(),
      text: text.trim(),
    };
    pending.current = body;
    const receipt = await command.run(JSON.stringify(body), () =>
      request(base + "/messages", { method: "POST", body }),
    );
    if (receipt) {
      pending.current = undefined;
      setText("");
      messages.reload();
    }
  }
  return (
    <section className="learner-stack">
      <h3>Trao đổi với người xử lý</h3>
      <p className="muted">
        Chỉ bạn và nhân sự được phân công xem nội dung này.
      </p>
      <Feedback
        loading={messages.loading}
        error={messages.error}
        reload={messages.reload}
      />
      <div aria-live="polite">
        {[...messages.items].reverse().map((row) => (
          <article key={row.id}>
            <strong>
              {row.senderId === actor.userId ? "Bạn" : "Người xử lý"}
            </strong>
            <small> · {formatTime(row.createdAt)}</small>
            <p className="learner-prose">{row.text}</p>
          </article>
        ))}
      </div>
      <More
        cursor={messages.cursor}
        loading={messages.loading}
        onMore={() => {
          void messages.more();
        }}
      />
      {!closed && (
        <form
          className="learner-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label>
            Nội dung
            <textarea
              required
              maxLength={4000}
              value={text}
              disabled={command.pending || command.uncertain}
              onChange={(e) => {
                pending.current = undefined;
                setText(e.target.value);
              }}
            />
          </label>
          <button
            className="btn btn-primary"
            disabled={command.pending || command.uncertain || !text.trim()}
          >
            Gửi phản hồi
          </button>
          {command.canRetry && (
            <button
              type="button"
              className="btn"
              disabled={command.pending}
              onClick={() => void send()}
            >
              Kiểm tra lại tin đã gửi
            </button>
          )}
        </form>
      )}
      <details>
        <summary>Bằng chứng riêng ({evidence.data?.length ?? 0})</summary>
        <Feedback
          loading={evidence.loading}
          error={evidence.error}
          reload={evidence.reload}
        />
        {evidence.data?.map((row) => (
          <p key={row.id}>
            {row.mimeType} · {formatTime(row.uploadedAt)}{" "}
            <button
              className="btn"
              disabled={downloadCommand.pending}
              onClick={() => {
                void downloadCommand.run("download:" + row.id, async () => {
                  const result = await request<{ url: string }>(
                    base + "/evidence/" + row.id + "/download",
                  );
                  if (!safeDownloadUrl(result.data.url))
                    throw new Error("Liên kết tải chưa hợp lệ.");
                  setDownload(result.data.url);
                  return result;
                });
              }}
            >
              Lấy liên kết tải
            </button>
          </p>
        ))}
        {download && (
          <a href={download} target="_blank" rel="noopener noreferrer">
            Mở bằng chứng ↗
          </a>
        )}
        {!closed && (
          <>
            <UploadControl
              endpoint="reports/evidence-files"
              label="Bổ sung bằng chứng"
              maxBytes={10000000}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={
                busy ||
                fileCommand.pending ||
                fileCommand.uncertain ||
                !!file ||
                (evidence.data?.length ?? 0) >= 5
              }
              onBusyChange={setBusy}
              onUploaded={(id) => setFile({ id, state: "PENDING" })}
            />
            {file && (
              <>
                <ReportEvidence
                  id={file.id}
                  onState={fileState}
                  disabled={fileCommand.pending || fileCommand.uncertain}
                  onRemove={() => setFile(undefined)}
                />
                <button
                  className="btn"
                  disabled={
                    file.state !== "READY" ||
                    fileCommand.pending ||
                    fileCommand.uncertain
                  }
                  onClick={() => {
                    void fileCommand
                      .run("evidence:" + file.id, () =>
                        request(base + "/evidence", {
                          method: "POST",
                          body: { fileId: file.id },
                        }),
                      )
                      .then((receipt) => {
                        if (receipt) {
                          setFile(undefined);
                          evidence.reload();
                        }
                      });
                  }}
                >
                  Gửi bằng chứng
                </button>
              </>
            )}
          </>
        )}
      </details>
      <CommandFeedback command={command} />
      <CommandFeedback command={fileCommand} />
      <CommandFeedback command={downloadCommand} />
      {downloadCommand.uncertain && (
        <button
          className="btn"
          disabled={downloadCommand.pending}
          onClick={() => downloadCommand.resetAfterRead()}
        >
          Thử mở lại bằng chứng
        </button>
      )}
      {fileCommand.uncertain && (
        <button
          className="btn"
          disabled={fileCommand.pending}
          onClick={async () => {
            try {
              await request<Evidence[]>(base + "/evidence");
              fileCommand.resetAfterRead();
              evidence.reload();
            } catch {
              evidence.reload();
            }
          }}
        >
          Kiểm tra lại bằng chứng
        </button>
      )}
    </section>
  );
}
