"use client";
import { formText } from "../components/form-data";
import { useState } from "react";
import { useUserSession } from "../auth/session";
import { useUserList, useUserResource } from "../hooks/use-user-resource";
import { useUserCommand } from "../hooks/use-user-command";
import {
  Back,
  CommandFeedback,
  Empty,
  Feedback,
  More,
  PageHeading,
  Panel,
  Status,
  formatTime,
} from "../components/common";
import { UploadControl } from "../components/upload-control";
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
    history = useUserList<Verification>(
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
                    loading={file.loading}
                    error={file.error}
                    reload={file.reload}
                  />
                  {file.data && (
                    <p>
                      Trạng thái tệp: <Status value={file.data.state} />
                    </p>
                  )}
                  <button
                    type="button"
                    className="btn"
                    onClick={file.reload}
                    disabled={file.loading}
                  >
                    Kiểm tra tệp
                  </button>
                </div>
              )}
              <CommandFeedback command={command} />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={
                  file.data?.state !== "READY" ||
                  command.pending ||
                  (command.uncertain && !command.canRetry)
                }
              >
                {submitLabel}
              </button>
            </form>
          )}
        </Panel>
        <Panel title="Lịch sử xác minh">
          <Feedback
            loading={history.loading}
            error={history.error}
            reload={history.reload}
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
          <More
            cursor={history.cursor}
            loading={history.loading}
            onMore={() => {
              void history.more();
            }}
          />
        </Panel>
      </div>
    </>
  );
}
