"use client";
import Link from "next/link";
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
import type { ReportCase, Material } from "./account-types";
import type { LearningSession } from "../types";
import { reportStatuses, reportStatusLabel } from "./report-status";
export const reportReasons = [
  ["NO_SHOW_LATE", "Vắng học / đến muộn"],
  ["INAPPROPRIATE_BEHAVIOR", "Hành vi không phù hợp"],
  ["HARASSMENT", "Quấy rối"],
  ["SKILL_MISMATCH", "Kỹ năng không phù hợp"],
  ["FALSE_INFORMATION", "Thông tin sai lệch"],
  ["TECHNICAL_ISSUE", "Sự cố kỹ thuật"],
  ["CREDIT_ISSUE", "Vấn đề Credit"],
  ["INAPPROPRIATE_CONTENT", "Nội dung không phù hợp"],
  ["SPAM_SCAM", "Spam / lừa đảo"],
  ["OTHER", "Khác"],
] as const;
export function ReportsScreen() {
  const query = useUserResource<ReportCase[]>("reports/mine");
  const [filter, setFilter] = useState("ALL");
  const items = query.data?.filter(
    (item) => filter === "ALL" || item.status === filter,
  );
  return (
    <>
      <PageHeading
        title="Báo cáo của tôi"
        description="Trạng thái xử lý các vấn đề bạn đã gửi."
      />
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <div className="learner-form">
        <label>
          Trạng thái báo cáo
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="ALL">Tất cả</option>
            {reportStatuses.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="learner-stack">
        {items?.map((item) => (
          <Panel key={item.id}>
            <div className="learner-card-top">
              <h2>
                {reportReasons.find(
                  ([code]) => code === item.reasonCode,
                )?.[1] ?? item.reasonCode}
              </h2>
              <Status
                value={item.status}
                label={reportStatusLabel(item.status)}
              />
            </div>
            <p className="learner-prose">{item.description}</p>
            <p className="muted">
              {item.createdAt
                ? formatTime(item.createdAt)
                : "Chưa ghi nhận thời điểm gửi"}
            </p>
            {item.resolutionNote && (
              <p className="learner-prose">Phản hồi: {item.resolutionNote}</p>
            )}
            <Link
              className="learner-card-link"
              href={"/learn/reports/" + item.id}
            >
              Theo dõi báo cáo →
            </Link>
            {item.relatedSessionId && (
              <Link
                className="learner-card-link"
                href={"/learn/sessions/" + item.relatedSessionId}
              >
                Xem buổi học →
              </Link>
            )}
          </Panel>
        ))}
      </div>
      {!query.loading && !query.error && !items?.length && (
        <Empty>
          {filter === "ALL"
            ? "Bạn chưa gửi báo cáo."
            : "Không có báo cáo ở trạng thái này."}
        </Empty>
      )}
    </>
  );
}
export function ReportForm({
  sessionId,
  materialId,
}: {
  sessionId?: string;
  materialId?: string;
}) {
  const { request } = useUserSession(),
    command = useUserCommand(),
    [sent, setSent] = useState<string | null>(null);
  const target = useUserResource<LearningSession | Material>(
    sessionId
      ? "sessions/" + sessionId
      : materialId
        ? "materials/" + materialId
        : null,
  );
  const path = sessionId
    ? "reports/sessions/" + sessionId
    : materialId
      ? "materials/" + materialId + "/reports"
      : null;
  return (
    <>
      <Back
        href={
          sessionId
            ? "/learn/sessions/" + sessionId
            : materialId
              ? "/learn/materials/" + materialId
              : "/learn/reports"
        }
      />
      <PageHeading
        eyebrow="CÙNG XÂY DỰNG CỘNG ĐỒNG AN TOÀN"
        title="Gửi báo cáo"
        description="Mô tả cụ thể vấn đề để đội ngũ hỗ trợ có thể xem xét."
      />
      <div className="learner-two-columns">
        <Panel title={sessionId ? "Báo cáo buổi học" : "Báo cáo tài liệu"}>
          <Feedback
            loading={target.loading}
            error={target.error}
            reload={target.reload}
          />
          {!path ? (
            <Empty>
              Chọn buổi học hoặc tài liệu cần báo cáo từ trang chi tiết.
            </Empty>
          ) : sent ? (
            <p className="learner-notice" role="status">
              Đã gửi báo cáo để xem xét.{" "}
              <Link href={"/learn/reports/" + sent}>Theo dõi báo cáo</Link>
            </p>
          ) : (
            target.data && (
              <form
                className="learner-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fields = new FormData(e.currentTarget);
                  const body = {
                    reasonCode: String(fields.get("reasonCode")),
                    description: String(fields.get("description")).trim(),
                    ...(sessionId ? { evidenceFileIds: [] } : {}),
                  };
                  const result = await command.run(
                    JSON.stringify({ path, body }),
                    () =>
                      request<{ id: string }>(path, { method: "POST", body }),
                  );
                  if (result) setSent(result.data.id);
                }}
              >
                {"title" in target.data ? (
                  <p>
                    Tài liệu: <strong>{target.data.title}</strong>
                  </p>
                ) : (
                  <p>Buổi học: {formatTime(target.data.startAt)}</p>
                )}
                <label>
                  Lý do báo cáo
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
                <label>
                  Mô tả chi tiết
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
                <button
                  className="btn btn-primary"
                  disabled={command.pending || command.uncertain}
                >
                  {command.pending ? "Đang gửi…" : "Gửi báo cáo"}
                </button>
              </form>
            )
          )}
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
