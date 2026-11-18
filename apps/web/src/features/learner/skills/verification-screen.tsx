"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import { formText } from "../components/form-data";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import {
  Back,
  CommandFeedback,
  Empty,
  Feedback,
  PageHeading,
  Panel,
  Status,
  formatTime,
} from "../components/common";
import { UploadControl } from "../components/upload-control";
import { safeDownloadUrl } from "../account/view-policy";
type Verification = {
  id: string;
  status: string;
  version: number;
  submittedAt: string;
  rejectReason: string | null;
  note: string | null;
  files: { id: string; title: string | null; approvalStatus: string }[];
};
export function VerificationScreen({ id }: Readonly<{ id: string }>) {
  const [fileId, setFileId] = useState(""),
    [sent, setSent] = useState(false),
    { request } = useUserSession(),
    command = useUserCommand(true);
  const file = useUserResource<{ fileId: string; state: string }>(
      fileId ? "me/skills/" + id + "/evidence-files/" + fileId : null,
    ),
    history = useUserPagedList<Verification>(
      "me/skills/" + id + "/verifications?limit=20",
    );
  let submitLabel: string;
  if (command.pending) submitLabel = "Đang gửi…";
  else if (command.canRetry) submitLabel = "Kiểm tra lại cùng yêu cầu";
  else submitLabel = "Gửi yêu cầu xác minh";
  return (
    <>
      <Back href="/learn/skills" />
      <PageHeading title="Xác minh kỹ năng" />
      <div className="learner-two-columns">
        <Panel title="Bằng chứng kỹ năng">
          {sent ? (
            <p className="learner-notice">
              <output>
                Đã gửi yêu cầu xác minh. Bạn có thể theo dõi trạng thái bên
                cạnh.
              </output>
            </p>
          ) : (
            <form
              className="learner-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const body = {
                  fileIds: [fileId],
                  title: formText(data, "title").trim(),
                  description: formText(data, "description").trim(),
                };
                const result = await command.run(JSON.stringify(body), (key) =>
                  request("me/skills/" + id + "/verifications", {
                    method: "POST",
                    key,
                    body,
                  }),
                );
                if (result) {
                  setSent(true);
                  history.reload();
                }
              }}
            >
              <label>
                <span>Tiêu đề bằng chứng</span>
                <input
                  name="title"
                  maxLength={120}
                  disabled={command.pending || command.uncertain}
                />
              </label>
              <label>
                <span>Mô tả</span>
                <textarea
                  name="description"
                  rows={4}
                  maxLength={500}
                  disabled={command.pending || command.uncertain}
                />
              </label>
              <UploadControl
                endpoint={"me/skills/" + id + "/evidence-files"}
                maxBytes={10000000}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                onUploaded={setFileId}
                disabled={command.pending || command.uncertain}
              />
              {fileId && (
                <div>
                  <Feedback
                    variant="inline"
                    loading={file.initialLoading}
                    error={file.error}
                    reload={file.reload}
                    refreshing={!!(file.loading && !file.initialLoading)}
                  />
                  {file.data && (
                    <p>
                      Trạng thái tệp: <Status value={file.data.state} />
                    </p>
                  )}
                  <LoadingButton
                    type="button"
                    className="btn"
                    onClick={file.reload}
                    disabled={file.loading}
                    loading={!!file.loading}
                  >
                    Kiểm tra tệp
                  </LoadingButton>
                </div>
              )}
              <CommandFeedback command={command} />
              <LoadingButton
                type="submit"
                className="btn btn-primary"
                disabled={
                  file.data?.state !== "READY" ||
                  command.pending ||
                  (command.uncertain && !command.canRetry)
                }
                loading={!!command.pending}
              >
                {submitLabel}
              </LoadingButton>
            </form>
          )}
        </Panel>
        <Panel title="Lịch sử xác minh">
          <Feedback
            loading={history.initialLoading}
            error={history.error}
            reload={history.reload}
            refreshing={!!(history.loading && !history.initialLoading)}
          />
          {history.items.map((item) => (
            <article className="product-pending" key={item.id}>
              <Status value={item.status} />
              <p>
                {formatTime(item.submittedAt)} · Phiên bản {item.version}
              </p>
              {item.files.map((f) => (
                <p key={f.id}>
                  {f.title ?? "Bằng chứng kỹ năng"} ·{" "}
                  <Status value={f.approvalStatus} />
                  {!["REVOKED"].includes(f.approvalStatus) && (
                    <OwnEvidenceDownload skillId={id} evidenceId={f.id} />
                  )}
                </p>
              ))}
              {item.rejectReason && (
                <p className="learner-error">{item.rejectReason}</p>
              )}
              {item.note && <p>{item.note}</p>}
            </article>
          ))}
          {!history.loading && !history.error && !history.items.length && (
            <Empty>Chưa có yêu cầu xác minh.</Empty>
          )}
          <ListPagination query={history} />
        </Panel>
      </div>
    </>
  );
}
function OwnEvidenceDownload({
  skillId,
  evidenceId,
}: Readonly<{ skillId: string; evidenceId: string }>) {
  const { request } = useUserSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [download, setDownload] = useState<{
    url: string;
    expiresAt: string;
  }>();
  return (
    <span>
      <LoadingButton
        type="button"
        className="btn"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(undefined);
          setDownload(undefined);
          try {
            const result = await request<{ url: string; expiresAt: string }>(
              `me/skills/${skillId}/evidence/${evidenceId}/download`,
            );
            if (
              !safeDownloadUrl(result.data.url) ||
              !Number.isFinite(Date.parse(result.data.expiresAt)) ||
              Date.parse(result.data.expiresAt) <= Date.now()
            )
              throw new Error("Liên kết tải chưa sẵn sàng. Vui lòng thử lại.");
            setDownload(result.data);
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Chưa tải được bằng chứng.",
            );
          } finally {
            setLoading(false);
          }
        }}
        loading={!!loading}
      >
        {loading ? "Đang lấy tệp…" : "Xem bằng chứng"}
      </LoadingButton>
      {download && (
        <a
          href={download.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => {
            if (Date.now() >= Date.parse(download.expiresAt)) {
              event.preventDefault();
              setDownload(undefined);
              setError("Liên kết đã hết hạn. Bấm Xem bằng chứng để lấy lại.");
            }
          }}
        >
          Mở tệp ↗
        </a>
      )}
      <Feedback error={error} />
    </span>
  );
}
