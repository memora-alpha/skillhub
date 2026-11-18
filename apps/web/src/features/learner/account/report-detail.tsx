"use client";
import { reportDescriptionText } from "@/lib/system-text";
import Link from "next/link";
import {
  Back,
  Empty,
  Feedback,
  PageHeading,
  Panel,
  Status,
  formatTime,
} from "../components/common";
import { useUserResource } from "../hooks/use-user-resource";
import type { ReportCase } from "./account-types";
import { reportReasonLabel } from "./report-reasons";
import { reportStatusLabel } from "./report-status";
import styles from "../components/learning-layout.module.css";
import { PrivateCaseThread } from "./private-case-thread";
import type { CaseCapabilities } from "./case-capabilities";

export function ReportDetail({ id }: Readonly<{ id: string }>) {
  const query = useUserResource<ReportCase>("reports/mine/" + id);
  const report = query.data;
  const summary = useUserResource<CaseCapabilities>(
    report?.relatedPathId
      ? `learning-paths/${report.relatedPathId}/cases/${id}/summary`
      : null,
  );
  const isOpen =
    !!report &&
    ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"].includes(report.status);
  const capabilities: CaseCapabilities = summary.data ?? {
    hasHandler: !!report?.handlerId,
    canSendMessage: !report?.relatedPathId && isOpen && !!report?.handlerId,
    messageBlockedReason: isOpen
      ? "CASE_HANDLER_REQUIRED"
      : "REPORT_CASE_CLOSED",
    canAttachEvidence:
      !report?.relatedPathId &&
      isOpen &&
      (report?.reportEvidenceCaseIdRecords.length ?? 0) < 5,
    evidenceBlockedReason: isOpen
      ? "CASE_EVIDENCE_LIMIT"
      : "REPORT_CASE_CLOSED",
    ownEvidenceCount: report?.reportEvidenceCaseIdRecords.length ?? 0,
  };
  return (
    <>
      <Back href="/learn/reports" />
      <PageHeading title="Theo dõi báo cáo" />
      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />
      {report && (
        <div className={styles.detailGrid}>
          <div className={styles.detailSummary}>
            <Panel title={reportReasonLabel(report.reasonCode)}>
              <Status
                value={report.status}
                label={reportStatusLabel(report.status)}
              />
              <p className="muted">Mã báo cáo: {report.id}</p>
              <p>
                {report.createdAt
                  ? formatTime(report.createdAt)
                  : "Chưa ghi nhận thời điểm gửi"}
              </p>
              <p className="learner-prose">
                {reportDescriptionText(report.description)}
              </p>
              <h3>Phản hồi xử lý</h3>
              <p className="learner-prose">
                {report.resolutionNote ??
                  "Chưa có phản hồi từ nhân sự phụ trách."}
              </p>
              {report.resolvedAt && (
                <p>Thời điểm xử lý: {formatTime(report.resolvedAt)}</p>
              )}
            </Panel>
            <Panel title="Thông tin liên quan">
              {report.blocksSettlement && (
                <p className="learner-notice">
                  Báo cáo đang giữ quyết toán lộ trình liên quan.
                </p>
              )}
              {report.relatedSessionId && (
                <p>
                  <Link href={"/learn/sessions/" + report.relatedSessionId}>
                    Xem buổi học →
                  </Link>
                </p>
              )}
              {report.relatedPathId && (
                <p>
                  <Link href={"/learn/paths/" + report.relatedPathId}>
                    Xem lộ trình →
                  </Link>
                </p>
              )}
              {report.relatedMaterialId && (
                <p>
                  <Link href={"/learn/materials/" + report.relatedMaterialId}>
                    Xem tài liệu →
                  </Link>
                </p>
              )}
            </Panel>
          </div>
          <div className="learner-stack">
            <Panel title="Trao đổi riêng với hỗ trợ">
              {report.relatedPathId && (
                <Feedback
                  loading={summary.initialLoading}
                  error={summary.error}
                  reload={summary.reload}
                  refreshing={!!(summary.loading && !summary.initialLoading)}
                />
              )}
              {(!report.relatedPathId || summary.data) && (
                <PrivateCaseThread
                  caseId={id}
                  capabilities={capabilities}
                  onRefresh={() => {
                    query.reload();
                    summary.reload();
                  }}
                />
              )}
            </Panel>
            <Panel title="Bằng chứng đã gửi">
              {report.reportEvidenceCaseIdRecords.map((file) => (
                <p key={file.id}>
                  Bằng chứng riêng tư · {file.mimeType} · {file.fileSizeBytes}{" "}
                  byte · {formatTime(file.uploadedAt)}
                </p>
              ))}
              {!report.reportEvidenceCaseIdRecords.length && (
                <Empty>Không có tệp bằng chứng đính kèm.</Empty>
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
