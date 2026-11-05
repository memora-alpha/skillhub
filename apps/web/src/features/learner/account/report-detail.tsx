"use client";
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
import { reportReasons } from "./reports-screen";
import { reportStatusLabel } from "./report-status";

export function ReportDetail({ id }: Readonly<{ id: string }>) {
  const query = useUserResource<ReportCase>("reports/mine/" + id);
  const report = query.data;
  return (
    <>
      <Back href="/learn/reports" />
      <PageHeading title="Theo dõi báo cáo" />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {report && (
        <div className="learner-two-columns">
          <Panel
            title={
              reportReasons.find(([code]) => code === report.reasonCode)?.[1] ??
              report.reasonCode
            }
          >
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
            <p className="learner-prose">{report.description}</p>
            <h3>Phản hồi xử lý</h3>
            <p className="learner-prose">
              {report.resolutionNote ??
                "Chưa có phản hồi từ nhân sự phụ trách."}
            </p>
            {report.resolvedAt && (
              <p>Thời điểm xử lý: {formatTime(report.resolvedAt)}</p>
            )}
            {report.status === "NEED_MORE_INFO" && (
              <p className="learner-notice">
                Nhân sự yêu cầu bổ sung thông tin. Chức năng gửi bổ sung trực
                tiếp hiện chưa khả dụng.
              </p>
            )}
          </Panel>
          <div className="learner-stack">
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
