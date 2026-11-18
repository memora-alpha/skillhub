"use client";
import Link from "next/link";
import { useState } from "react";
import { Card, StatusBadge } from "@/components/console/ui";
import { useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { DecisionDialog, QueueState } from "./common";
import { severities, type Incident } from "./report-support-types";
import type { ReportCaseDetail } from "@/lib/staff/types";
import { assertReportEditable } from "@/lib/staff/report-access";
import {
  assertReportRuling,
  assertReportRulingCurrent,
} from "@/lib/staff/report-ruling";
import {
  type ResolutionDraft,
  reportResolutionBody,
} from "@/lib/staff/report-resolution";
import { ReportRulingFields } from "./report-ruling-fields";
export function IncidentPanel({
  id,
  close,
  onUpdated,
  readOnly = false,
}: Readonly<{
  id: string;
  close: () => void;
  onUpdated: () => unknown;
  readOnly?: boolean;
}>) {
  const { api, actor, portal } = useStaffSession();
  const resource = useStaffResource<Incident>(
    `reports/support/incidents/${id}`,
  );
  const [decision, setDecision] = useState<"resolve" | "reject">();
  const [severity, setSeverity] = useState("MEDIUM");
  const [classifying, setClassifying] = useState(false);
  return (
    <Card>
      <div className="row">
        <h2>Vụ việc chung</h2>
        <button type="button" className="btn" onClick={close}>
          Đóng
        </button>
      </div>
      <QueueState
        loading={resource.loading}
        error={resource.error}
        empty={!resource.data}
        reload={resource.reload}
      >
        {resource.data && (
          <>
            <p>{resource.data.reason}</p>
            <StatusBadge status={resource.data.status} />
            <ul>
              {resource.data.cases.map((c) => (
                <li key={c.id}>
                  <Link className="link" href={`/${portal}/disputes/${c.id}`}>
                    {c.id}
                  </Link>{" "}
                  · {c.status}
                </li>
              ))}
            </ul>
            {!readOnly &&
              resource.data.status === "OPEN" &&
              resource.data.handlerId === actor?.userId && (
                <div className="row">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setSeverity(resource.data!.severity);
                      setClassifying(true);
                    }}
                  >
                    Đổi mức độ
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setDecision("resolve")}
                  >
                    Giải quyết chung
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setDecision("reject")}
                  >
                    Bác bỏ chung
                  </button>
                </div>
              )}
            {classifying && !readOnly && (
              <DecisionDialog
                title="Đổi mức độ vụ việc"
                description="Áp dụng cho các báo cáo đã gom."
                min={3}
                max={2000}
                confirmLabel="Lưu"
                onClose={() => setClassifying(false)}
                onReload={resource.reload}
                onSubmit={async (reason) => {
                  for (const member of resource.data!.cases) {
                    const fresh = await api<ReportCaseDetail>(
                      `reports/${member.id}`,
                    );
                    assertReportEditable(fresh.data);
                  }
                  await api(`reports/support/incidents/${id}/severity`, {
                    method: "POST",
                    body: {
                      severity,
                      reason,
                      expectedVersion: resource.data!.version,
                    },
                  });
                  setClassifying(false);
                  await resource.reload();
                  onUpdated();
                }}
              >
                <SeveritySelect value={severity} onChange={setSeverity} />
              </DecisionDialog>
            )}
            {decision && !readOnly && !!resource.data.cases.length && (
              <IncidentDecision
                key={decision}
                incident={resource.data}
                action={decision}
                close={() => setDecision(undefined)}
                reload={resource.reload}
                onUpdated={onUpdated}
              />
            )}
          </>
        )}
      </QueueState>
    </Card>
  );
}
export function SeveritySelect({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (value: string) => void }>) {
  return (
    <label>
      <span>Mức độ</span>
      <select
        className="select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {severities.map((s) => (
          <option key={s.code} value={s.code}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function IncidentDecision({
  incident,
  action,
  close,
  reload,
  onUpdated,
}: Readonly<{
  incident: Incident;
  action: "resolve" | "reject";
  close: () => void;
  reload: () => unknown;
  onUpdated: () => unknown;
}>) {
  const { api, actor } = useStaffSession();
  // The server applies the Session ruling to the lowest case ID once, then closes the other cases.
  const caseId = incident.cases
    .map((item) => item.id)
    .sort((a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    })[0]!;
  const detail = useStaffResource<ReportCaseDetail>("reports/" + caseId);
  const [draft, setDraft] = useState<ResolutionDraft>({
    participants: [],
    restrictedUserId: "",
    days: "1",
    reversals: "",
  });
  return (
    <DecisionDialog
      title={
        action === "resolve"
          ? "Giải quyết vụ việc chung"
          : "Bác bỏ vụ việc chung"
      }
      description="Phán quyết buổi học được áp dụng một lần; trạng thái được cập nhật cho tất cả báo cáo trong vụ việc."
      min={3}
      max={2000}
      confirmLabel="Xác nhận quyết định"
      onClose={close}
      onReload={() => {
        void detail.reload();
        void reload();
      }}
      onSubmit={async (note) => {
        for (const member of incident.cases) {
          const fresh = await api<ReportCaseDetail>(`reports/${member.id}`);
          assertReportEditable(fresh.data);
        }
        if (!detail.data || detail.loading || detail.error)
          throw new Error(
            "Chưa tải được điều kiện xử lý. Hãy tải lại dữ liệu trước khi quyết định.",
          );
        assertReportRuling(detail.data, draft, action);
        const fresh = await api<ReportCaseDetail>("reports/" + caseId);
        assertReportRulingCurrent(detail.data, fresh.data);
        assertReportRuling(fresh.data, draft, action);
        const participants = fresh.data.session
          ? [fresh.data.session.teacherId, fresh.data.session.learnerId].map(
              (userId) => ({
                userId,
                violation: "" as const,
                delta: "",
                amount: "",
              }),
            )
          : [];
        const ruling =
          action === "resolve"
            ? reportResolutionBody({ ...draft, participants }, false)
            : {};
        await api(`reports/support/incidents/${incident.id}/decision`, {
          method: "POST",
          body: { action, note, expectedVersion: incident.version, ...ruling },
        });
        void reload();
        onUpdated();
      }}
    >
      <QueueState
        loading={detail.loading}
        error={detail.error}
        empty={!detail.data}
        reload={detail.reload}
      >
        {detail.data && action === "resolve" && (
          <ReportRulingFields
            item={detail.data}
            value={draft}
            onChange={setDraft}
            admin={actor?.roles.includes("ADMIN")}
          />
        )}
        {detail.data && action === "reject" && (
          <p className="muted">
            Chỉ bác bỏ khi báo cáo không đủ căn cứ. Buổi học đang tranh chấp cần
            một phán quyết trước khi đóng vụ việc.
          </p>
        )}
      </QueueState>
    </DecisionDialog>
  );
}
