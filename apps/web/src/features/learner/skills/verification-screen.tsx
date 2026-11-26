"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useUserPagedList } from "../hooks/use-user-paged-list";
import { formText } from "../components/form-data";
import { useCallback, useEffect, useState } from "react";
import { useUserSnapshot } from "../hooks/use-user-snapshot";
import type { SharingSkill } from "../types";
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
  reviewedAt?: string | null;
  rejectReason: string | null;
  note: string | null;
  files: {
    id: string;
    title: string | null;
    approvalStatus: string;
    revokedReason?: string | null;
  }[];
};
export function VerificationScreen({ id }: Readonly<{ id: string }>) {
  const [fileIds, setFileIds] = useState<string[]>([]),
    [states, setStates] = useState<Record<string, string>>({}),
    [sent, setSent] = useState(false),
    { request } = useUserSession(),
    command = useUserCommand(true);
  const skillSnapshot = useUserSnapshot<SharingSkill>(
    "me/skills?includeArchived=true&limit=50",
    { stopAt: (skill) => skill.id === id },
  );
  const skill = skillSnapshot.items.find((row) => row.id === id);
  const history = useUserPagedList<Verification>(
    "me/skills/" + id + "/verifications?limit=20",
  );
  const pending = useUserSnapshot<Verification>(
    "me/skills/" + id + "/verifications?limit=50",
    { stopAt: (row) => row.status === "PENDING" },
  );
  const updateState = useCallback(
    (fileId: string, state: string) =>
      setStates((previous) =>
        previous[fileId] === state
          ? previous
          : { ...previous, [fileId]: state },
      ),
    [],
  );
  const hasPending = pending.items.some((item) => item.status === "PENDING");
  const blocked =
    command.pending ||
    command.uncertain ||
    !skillSnapshot.complete ||
    !pending.complete ||
    !!skillSnapshot.error ||
    !!pending.error ||
    !skill ||
    skill.archivedAt !== null;
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
          {sent || hasPending ? (
            <p className="learner-notice">
              <output>
                {sent
                  ? "Đã gửi yêu cầu xác minh. Bạn có thể theo dõi trạng thái bên cạnh."
                  : "Kỹ năng đang có yêu cầu xác minh chờ duyệt. Vui lòng chờ kết quả trước khi gửi yêu cầu mới."}
              </output>
            </p>
          ) : (
            <form
              className="learner-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const body = {
                  fileIds,
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
                  pending.reload();
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
                onUploaded={(fileId) =>
                  setFileIds((previous) =>
                    previous.includes(fileId) || previous.length >= 5
                      ? previous
                      : [...previous, fileId],
                  )
                }
                disabled={blocked || fileIds.length >= 5}
              />
              <p>
                Đính kèm từ 1 đến 5 tệp. Tất cả tệp cần quét sạch trước khi gửi.
              </p>
              <Feedback error={skillSnapshot.error ?? pending.error} />
              {skill?.archivedAt && (
                <p className="learner-notice">
                  Khôi phục kỹ năng trước khi gửi xác minh mới.
                </p>
              )}
              {fileIds.map((fileId) => (
                <VerificationFile
                  key={fileId}
                  skillId={id}
                  fileId={fileId}
                  onState={updateState}
                  remove={() =>
                    setFileIds((previous) =>
                      previous.filter((value) => value !== fileId),
                    )
                  }
                  disabled={command.pending || command.uncertain}
                />
              ))}
              <CommandFeedback command={command} />
              <LoadingButton
                type="submit"
                className="btn btn-primary"
                disabled={
                  !fileIds.length ||
                  fileIds.some((fileId) => states[fileId] !== "READY") ||
                  (blocked && !command.canRetry) ||
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
              <VerificationDetails skillId={id} id={item.id} />
              <p>
                {formatTime(item.submittedAt)} · Phiên bản {item.version}
                {item.reviewedAt
                  ? ` · Duyệt lúc ${formatTime(item.reviewedAt)}`
                  : ""}
              </p>
              {item.files.map((f) => (
                <p key={f.id}>
                  {f.title ?? "Bằng chứng kỹ năng"} ·{" "}
                  <Status value={f.approvalStatus} />
                  {f.revokedReason ? ` (${f.revokedReason})` : ""}
                  <OwnEvidenceDownload skillId={id} evidenceId={f.id} />
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
function VerificationFile({
  skillId,
  fileId,
  onState,
  remove,
  disabled,
}: Readonly<{
  skillId: string;
  fileId: string;
  onState: (id: string, state: string) => void;
  remove: () => void;
  disabled: boolean;
}>) {
  const file = useUserResource<{ state: string; moderationStatus?: string }>(
    `me/skills/${skillId}/evidence-files/${fileId}`,
    {
      refetchInterval: (value) =>
        value &&
        ["UPLOADING", "QUARANTINED", "SCANNING"].includes(value.state) &&
        !["REVIEW_REQUIRED", "FAILED"].includes(value.moderationStatus ?? "")
          ? 3000
          : false,
    },
  );
  const needsReview = file.data?.moderationStatus === "REVIEW_REQUIRED";
  const state = file.error
    ? "UNAVAILABLE"
    : needsReview
      ? "REVIEW_REQUIRED"
      : (file.data?.state ?? "CHECKING");
  useEffect(() => onState(fileId, state), [fileId, state, onState]);
  return (
    <div>
      <p>
        Tệp {fileId.slice(0, 8)}:{" "}
        <Status
          value={state}
          label={
            needsReview ? "Cần kiểm duyệt thêm trước khi sử dụng" : undefined
          }
        />
      </p>
      <Feedback error={file.error} reload={file.reload} />
      <button
        type="button"
        className="btn"
        disabled={disabled}
        onClick={remove}
      >
        Bỏ tệp này
      </button>
    </div>
  );
}
function VerificationDetails({
  skillId,
  id,
}: Readonly<{ skillId: string; id: string }>) {
  const [open, setOpen] = useState(false);
  const query = useUserResource<Verification>(
    open ? `me/skills/${skillId}/verifications/${id}` : null,
    {
      refetchInterval: (value) => (value?.status === "PENDING" ? 10000 : false),
    },
  );
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Chi tiết lần xác minh</summary>
      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
      />
      {query.data && (
        <>
          <p>
            {query.data.note ||
              query.data.rejectReason ||
              "Chưa có ghi chú xử lý."}
          </p>
          {query.data.reviewedAt && (
            <p>Xét duyệt: {formatTime(query.data.reviewedAt)}</p>
          )}
        </>
      )}
    </details>
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
