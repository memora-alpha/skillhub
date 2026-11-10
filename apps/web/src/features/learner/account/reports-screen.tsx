"use client";
import { reportDescriptionText } from "@/lib/system-text";
import Link from "next/link";
import { useCallback, useState } from "react";
import { UploadControl } from "../components/upload-control";
import { ReportEvidence } from "./report-evidence";
import { UserApiError } from "../api/client";
import { formText } from "../components/form-data";
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
import type { ReportCase, Material } from "./account-types";
import type { LearningSession } from "../types";
import { reportStatuses, reportStatusLabel } from "./report-status";
import {
  canSubmitReportReason,
  reportReasonLabel,
  reportReasons,
} from "./report-reasons";
import styles from "../components/learning-layout.module.css";
import { ProductIcon } from "../components/product-icon";
export { reportReasons } from "./report-reasons";
export function ReportsScreen() {
  const query = useUserResource<ReportCase[]>("reports/mine");
  const [filter, setFilter] = useState("ALL");
  const items = query.data?.filter(
    (item) => filter === "ALL" || item.status === filter,
  );
  return (
    <div className={styles.page}>
      <PageHeading
        title="Báo cáo của tôi"
        description="Theo dõi phản hồi và bổ sung thông tin cho các báo cáo bạn đã gửi."
      />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <div className={styles.filters} aria-label="Trạng thái báo cáo">
        {[["ALL", "Tất cả"], ...reportStatuses].map(([code, label]) => (
          <button
            type="button"
            key={code}
            aria-pressed={filter === code}
            onClick={() => setFilter(code!)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.reportList}>
        {items?.map((item) => {
          function reportTargetLabel() {
            if (item.relatedSessionId) {
              return "Buổi học";
            }
            if (item.relatedMaterialId) {
              return "Tài liệu";
            }
            return "Báo cáo hỗ trợ";
          }
          return (
            <Panel key={item.id} className={styles.reportCard}>
              <div className={styles.reportTop}>
                <h2>{reportReasonLabel(item.reasonCode)}</h2>
                <Status
                  value={item.status}
                  label={reportStatusLabel(item.status)}
                />
              </div>
              <p className="learner-prose">
                {reportDescriptionText(item.description)}
              </p>
              <div className={styles.meta}>
                <span>
                  <ProductIcon name="calendar" size={16} />
                  {item.createdAt
                    ? formatTime(item.createdAt)
                    : "Chưa ghi nhận thời điểm gửi"}
                </span>
                <span>{reportTargetLabel()}</span>
              </div>
              {item.resolutionNote && (
                <p className="learner-prose">Phản hồi: {item.resolutionNote}</p>
              )}
              <div className={styles.actions}>
                <Link
                  className="btn btn-primary"
                  href={"/learn/reports/" + item.id}
                >
                  {item.status === "NEED_MORE_INFO"
                    ? "Bổ sung thông tin →"
                    : "Xem chi tiết →"}
                </Link>
                {item.relatedSessionId && (
                  <Link
                    className="learner-card-link"
                    href={"/learn/sessions/" + item.relatedSessionId}
                  >
                    Xem buổi học →
                  </Link>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
      {!query.loading && !query.error && !items?.length && (
        <Empty>
          {filter === "ALL"
            ? "Bạn chưa gửi báo cáo."
            : "Không có báo cáo ở trạng thái này."}
        </Empty>
      )}
    </div>
  );
}
function reportTarget(sessionId?: string, materialId?: string) {
  if (sessionId)
    return {
      resource: "sessions/" + sessionId,
      path: "reports/sessions/" + sessionId,
      back: "/learn/sessions/" + sessionId,
    };
  if (materialId)
    return {
      resource: "materials/" + materialId,
      path: "materials/" + materialId + "/reports",
      back: "/learn/materials/" + materialId,
    };
  return { resource: null, path: null, back: "/learn/reports" };
}

function ReportSubmission({
  target,
  path,
  sessionId,
  onSent,
}: Readonly<{
  target: LearningSession | Material;
  path: string;
  sessionId?: string;
  onSent: (id: string) => void;
}>) {
  const { request } = useUserSession();
  const command = useUserCommand();
  const [files, setFiles] = useState<{ id: string; state: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const updateFile = useCallback(
    (id: string, state: string) =>
      setFiles((rows) =>
        rows.map((row) =>
          row.id === id && row.state !== state ? { id, state } : row,
        ),
      ),
    [],
  );
  return (
    <form
      className="learner-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (uploading || command.pending || command.uncertain) return;
        const fields = new FormData(e.currentTarget);
        const body = {
          reasonCode: formText(fields, "reasonCode"),
          description: formText(fields, "description").trim(),
          ...(sessionId
            ? { evidenceFileIds: files.map((file) => file.id) }
            : {}),
        };
        const result = await command.run(
          JSON.stringify({ path, body }),
          async () => {
            if (!canSubmitReportReason(body.reasonCode))
              throw new UserApiError(400, "REPORT_REASON_INVALID");
            if (sessionId) {
              const fresh = (
                await request<LearningSession>("sessions/" + sessionId)
              ).data;
              if (fresh.status === "CANCELLED")
                throw new UserApiError(409, "SESSION_NOT_REPORTABLE");
              if (files.some((file) => file.state !== "READY"))
                throw new UserApiError(409, "FILE_NOT_CLEAN");
            }
            return request<{ id: string }>(path, { method: "POST", body });
          },
        );
        if (result) onSent(result.data.id);
      }}
    >
      {"title" in target ? (
        <p>
          Tài liệu: <strong>{target.title}</strong>
        </p>
      ) : (
        <p>Buổi học: {formatTime(target.startAt)}</p>
      )}
      <label>
        <span>Lý do báo cáo</span>
        <select
          name="reasonCode"
          disabled={command.pending || command.uncertain}
        >
          {reportReasons.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {sessionId && (
        <>
          <p>
            Báo cáo dành cho sự cố kỹ thuật hoặc vấn đề khác cần hỗ trợ. Vắng
            học, hủy buổi và học bù được xử lý trong chi tiết buổi học, không
            cần tạo báo cáo vắng học. Báo cáo sau giải ngân không tự đảo giao
            dịch Credit.
          </p>
          <Link href={"/learn/sessions/" + sessionId}>
            Xử lý vắng học / hủy buổi / học bù
          </Link>
          <UploadControl
            endpoint="reports/evidence-files"
            label="Tệp bằng chứng"
            onBusyChange={setUploading}
            maxBytes={10000000}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={command.pending || command.uncertain || files.length >= 5}
            onUploaded={(id) =>
              setFiles((rows) =>
                rows.some((r) => r.id === id)
                  ? rows
                  : [...rows, { id, state: "PENDING" }],
              )
            }
          />
          <small>
            Tối đa 5 bằng chứng. Chỉ gửi khi mọi tệp đã được máy chủ kiểm tra.
          </small>
          {files.map((file) => (
            <ReportEvidence
              key={file.id}
              id={file.id}
              onState={updateFile}
              disabled={command.pending || command.uncertain}
              onRemove={() =>
                setFiles((rows) => rows.filter((r) => r.id !== file.id))
              }
            />
          ))}
        </>
      )}
      <label>
        <span>Mô tả chi tiết</span>
        <textarea
          name="description"
          minLength={10}
          maxLength={2000}
          rows={7}
          required
          disabled={command.pending || command.uncertain}
          placeholder="Điều gì đã xảy ra? Thời điểm và nội dung cần xem xét…"
        />
      </label>
      <CommandFeedback command={command} />
      {(command.uncertain ||
        command.failure?.code === "ACTIVE_SESSION_REPORT_EXISTS") && (
        <Link href="/learn/reports">
          Kiểm tra báo cáo đã gửi trước khi thao tác tiếp
        </Link>
      )}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={
          uploading ||
          command.pending ||
          command.uncertain ||
          files.some((file) => file.state !== "READY") ||
          ("status" in target && target.status === "CANCELLED")
        }
      >
        {command.pending ? "Đang gửi…" : "Gửi báo cáo"}
      </button>
    </form>
  );
}

export function ReportForm({
  sessionId,
  materialId,
}: Readonly<{ sessionId?: string; materialId?: string }>) {
  const [sent, setSent] = useState<string | null>(null);
  const { resource, path, back } = reportTarget(sessionId, materialId);
  const target = useUserResource<LearningSession | Material>(resource);
  let content;
  if (!path)
    content = (
      <Empty>Chọn buổi học hoặc tài liệu cần báo cáo từ trang chi tiết.</Empty>
    );
  else if (sent)
    content = (
      <p className="learner-notice">
        <output>
          Đã gửi báo cáo để xem xét.{" "}
          <Link href={"/learn/reports/" + sent}>Theo dõi báo cáo</Link>
        </output>
      </p>
    );
  else if (target.data)
    content = (
      <ReportSubmission
        key={path}
        target={target.data}
        path={path}
        sessionId={sessionId}
        onSent={setSent}
      />
    );
  return (
    <>
      <Back href={back} />
      <PageHeading title="Gửi báo cáo" />
      <div className="learner-two-columns">
        <Panel title={sessionId ? "Báo cáo buổi học" : "Báo cáo tài liệu"}>
          <Feedback
            loading={target.loading}
            error={target.error}
            reload={target.reload}
          />
          {content}
        </Panel>
        <Panel title="Để được hỗ trợ tốt hơn">
          <p>
            Cung cấp thông tin chính xác, tôn trọng quyền riêng tư của người
            khác.
          </p>
          <p>
            Báo cáo sẽ được đội ngũ phụ trách xem xét theo trạng thái của buổi
            học hoặc tài liệu.
          </p>
        </Panel>
      </div>
    </>
  );
}
