"use client";
import Link from "next/link";
import { useState } from "react";
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
          <span>Trạng thái báo cáo</span>
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
  return (
    <form
      className="learner-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const fields = new FormData(e.currentTarget);
        const body = {
          reasonCode: formText(fields, "reasonCode"),
          description: formText(fields, "description").trim(),
          ...(sessionId ? { evidenceFileIds: [] } : {}),
        };
        const result = await command.run(JSON.stringify({ path, body }), () =>
          request<{ id: string }>(path, { method: "POST", body }),
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
      <button
        type="submit"
        className="btn btn-primary"
        disabled={command.pending || command.uncertain}
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
        target={target.data}
        path={path}
        sessionId={sessionId}
        onSent={setSent}
      />
    );
  return (
    <>
      <Back href={back} />
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
