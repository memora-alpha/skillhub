"use client";
import Link from "next/link";
import { useState } from "react";
import { Card, StatusBadge } from "@/components/console/ui";
import { useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { DecisionDialog, QueueState } from "./common";
import { Identifier } from "./operation-tools";
import { severities, type Incident } from "./report-support-types";
export function IncidentPanel({
  id,
  close,
  onUpdated,
}: Readonly<{ id: string; close: () => void; onUpdated: () => unknown }>) {
  const { api, actor, portal } = useStaffSession();
  const resource = useStaffResource<Incident>(
    `reports/support/incidents/${id}`,
  );
  const [decision, setDecision] = useState<"resolve" | "reject">();
  const [severity, setSeverity] = useState("MEDIUM");
  const [classifying, setClassifying] = useState(false);
  const [ruling, setRuling] = useState("");
  const [makeupUserId, setMakeupUserId] = useState("");
  return (
    <Card>
      <div className="row">
        <h2>Vụ việc chung</h2>
        <button className="btn" onClick={close}>
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
            {resource.data.status === "OPEN" &&
              resource.data.handlerId === actor?.userId && (
                <div className="row">
                  <button
                    className="btn"
                    onClick={() => {
                      setSeverity(resource.data!.severity);
                      setClassifying(true);
                    }}
                  >
                    Đổi mức độ
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => setDecision("resolve")}
                  >
                    Giải quyết chung
                  </button>
                  <button className="btn" onClick={() => setDecision("reject")}>
                    Bác bỏ chung
                  </button>
                </div>
              )}
            {classifying && (
              <DecisionDialog
                title="Đổi mức độ vụ việc"
                description="Áp dụng cho các báo cáo đã gom."
                min={3}
                max={2000}
                confirmLabel="Lưu"
                onClose={() => setClassifying(false)}
                onReload={resource.reload}
                onSubmit={async (reason) => {
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
            {decision && (
              <DecisionDialog
                title={
                  decision === "resolve"
                    ? "Giải quyết vụ việc chung"
                    : "Bác bỏ vụ việc chung"
                }
                description="Quyết định được áp dụng đồng thời cho tất cả báo cáo liên quan."
                min={3}
                max={2000}
                confirmLabel="Xác nhận quyết định"
                onClose={() => setDecision(undefined)}
                onReload={resource.reload}
                onSubmit={async (note) => {
                  await api(`reports/support/incidents/${id}/decision`, {
                    method: "POST",
                    body: {
                      action: decision,
                      note,
                      expectedVersion: resource.data!.version,
                      ...(ruling ? { noShowRuling: ruling } : {}),
                      ...(makeupUserId ? { makeupUserId } : {}),
                    },
                  });
                  setDecision(undefined);
                  await resource.reload();
                  onUpdated();
                }}
              >
                <label>
                  Phán quyết điểm danh
                  <select
                    className="select"
                    value={ruling}
                    onChange={(e) => setRuling(e.target.value)}
                  >
                    <option value="">Không áp dụng</option>
                    <option value="UPHOLD">Giữ kết luận vắng mặt</option>
                    <option value="EXCUSE">Chấp nhận lý do vắng</option>
                    <option value="COMPLETE">Công nhận hoàn thành</option>
                  </select>
                </label>
                {ruling === "EXCUSE" && (
                  <Identifier
                    label="Người được học bù"
                    value={makeupUserId}
                    onChange={setMakeupUserId}
                  />
                )}
              </DecisionDialog>
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
      Mức độ
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
