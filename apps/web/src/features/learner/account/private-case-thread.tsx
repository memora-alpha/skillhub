"use client";
import { LoadingButton } from "@/components/loading-button";
import styles from "../components/learning-layout.module.css";
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
import type { CaseCapabilities } from "./case-capabilities";
import { userErrorText } from "../api/client";
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
  capabilities,
  onRefresh,
}: Readonly<{
  caseId: string;
  capabilities: CaseCapabilities;
  onRefresh: () => void;
}>) {
  const { actor } = useUserSession();
  return (
    <CaseThreadContent
      key={`${actor.userId}:${caseId}`}
      caseId={caseId}
      capabilities={capabilities}
      onRefresh={onRefresh}
    />
  );
}
function CaseThreadContent({
  caseId,
  capabilities,
  onRefresh,
}: Readonly<{
  caseId: string;
  capabilities: CaseCapabilities;
  onRefresh: () => void;
}>) {
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
    if (!capabilities.canSendMessage) return;
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
    onRefresh();
  }
  return (
    <section className={"learner-stack " + styles.thread}>
      <h3>Trao đổi với người xử lý</h3>
      <p className="muted">
        Chỉ bạn và nhân sự được phân công xem nội dung này.
      </p>
      <Feedback
        loading={messages.initialLoading}
        error={messages.error}
        reload={messages.reload}
        refreshing={!!(messages.loading && !messages.initialLoading)}
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
      {!capabilities.canSendMessage && (
        <p className="learner-notice">
          {userErrorText(
            409,
            capabilities.messageBlockedReason ?? "REPORT_CASE_CLOSED",
          )}{" "}
          <button type="button" className="btn" onClick={onRefresh}>
            Cập nhật vụ việc
          </button>
        </p>
      )}
      {capabilities.canSendMessage && (
        <form
          className="learner-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label>
            <span>Nội dung</span>
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
          <LoadingButton
            type="submit"
            className="btn btn-primary"
            disabled={command.pending || command.uncertain || !text.trim()}
            loading={!!command.pending}
          >
            Gửi phản hồi
          </LoadingButton>
          {command.canRetry && (
            <LoadingButton
              type="button"
              className="btn"
              disabled={command.pending}
              onClick={() => void send()}
              loading={!!command.pending}
            >
              Kiểm tra lại tin đã gửi
            </LoadingButton>
          )}
        </form>
      )}
      <details>
        <summary>
          Bằng chứng riêng (
          {Math.max(evidence.data?.length ?? 0, capabilities.ownEvidenceCount)}
          /5)
        </summary>
        <Feedback
          loading={evidence.initialLoading}
          error={evidence.error}
          reload={evidence.reload}
          refreshing={!!(evidence.loading && !evidence.initialLoading)}
        />
        {evidence.data?.map((row) => (
          <p key={row.id}>
            {row.mimeType} · {formatTime(row.uploadedAt)}{" "}
            <LoadingButton
              type="button"
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
              loading={!!downloadCommand.pending}
            >
              Lấy liên kết tải
            </LoadingButton>
          </p>
        ))}
        {download && (
          <a href={download} target="_blank" rel="noopener noreferrer">
            Mở bằng chứng ↗
          </a>
        )}
        {!capabilities.canAttachEvidence && (
          <p className="muted">
            {userErrorText(
              409,
              capabilities.evidenceBlockedReason ?? "REPORT_CASE_CLOSED",
            )}
          </p>
        )}
        {capabilities.canAttachEvidence && (
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
                Math.max(
                  evidence.data?.length ?? 0,
                  capabilities.ownEvidenceCount,
                ) >= 5
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
                <LoadingButton
                  type="button"
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
                        onRefresh();
                        if (receipt) {
                          setFile(undefined);
                          evidence.reload();
                        }
                      });
                  }}
                  loading={!!fileCommand.pending}
                >
                  Gửi bằng chứng
                </LoadingButton>
              </>
            )}
          </>
        )}
      </details>
      <CommandFeedback command={command} />
      <CommandFeedback command={fileCommand} />
      <CommandFeedback command={downloadCommand} />
      {downloadCommand.uncertain && (
        <LoadingButton
          type="button"
          className="btn"
          disabled={downloadCommand.pending}
          onClick={() => downloadCommand.resetAfterRead()}
          loading={!!downloadCommand.pending}
        >
          Thử mở lại bằng chứng
        </LoadingButton>
      )}
      {fileCommand.uncertain && (
        <LoadingButton
          type="button"
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
          loading={!!fileCommand.pending}
        >
          Kiểm tra lại bằng chứng
        </LoadingButton>
      )}
    </section>
  );
}
