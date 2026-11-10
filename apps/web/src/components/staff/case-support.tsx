"use client";
import { useState } from "react";
import { Card } from "@/components/console/ui";
import { useStaffSession } from "./session";
import { DecisionDialog } from "./common";
import { Identifier } from "./operation-tools";
import type { ReportCaseDetail } from "@/lib/staff/types";
import { IncidentPanel } from "./report-incident";
import { PrivateThread } from "./case-private-thread";
export function CaseSupportPanel({
  item,
  onUpdated,
}: Readonly<{ item: ReportCaseDetail; onUpdated: () => unknown }>) {
  const { actor, api } = useStaffSession();
  const [party, setParty] = useState("");
  const [draft, setDraft] = useState("");
  const [incident, setIncident] = useState(false);
  const [needInfo, setNeedInfo] = useState(false);
  const parties = [
    ...new Set(
      [
        item.reporterId,
        item.targetType === "USER" ? item.targetId : null,
        item.path?.participantAId,
        item.path?.participantBId,
        item.session?.teacherId,
        item.session?.learnerId,
      ].filter((id): id is string => !!id),
    ),
  ];
  const owns = item.handlerId === actor?.userId;
  const open = ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"].includes(item.status);
  return (
    <Card>
      <h2>Trao đổi riêng</h2>
      {!owns ? (
        <p>Nhận xử lý báo cáo để trao đổi với các bên.</p>
      ) : (
        <>
          <label>
            <span>Bên liên quan</span>
            <select
              className="select"
              value={party}
              onChange={(e) => setParty(e.target.value)}
            >
              <option value="">Chọn người trao đổi</option>
              {parties.map((p) => (
                <option key={p} value={p}>
                  {p}
                  {p === item.reporterId ? " · Người báo cáo" : ""}
                </option>
              ))}
            </select>
          </label>
          {item.relatedOrderId && (
            <details>
              <summary>Trao đổi với bên mua hoặc bán khác</summary>
              <form
                className="toolbar"
                onSubmit={(e) => {
                  e.preventDefault();
                  setParty(draft);
                }}
              >
                <Identifier value={draft} onChange={setDraft} />
                <button type="submit" className="btn">
                  Mở trao đổi
                </button>
              </form>
            </details>
          )}
          {party && (
            <PrivateThread
              key={`${item.id}:${party}`}
              caseId={item.id}
              partyId={party}
              readOnly={!open}
            />
          )}
          {open && (
            <button
              type="button"
              className="btn"
              onClick={() => setNeedInfo(true)}
            >
              Yêu cầu bổ sung
            </button>
          )}
        </>
      )}
      {item.incidentId && (
        <button type="button" className="btn" onClick={() => setIncident(true)}>
          Mở quyết định vụ việc chung
        </button>
      )}
      {incident && item.incidentId && (
        <IncidentPanel
          id={item.incidentId}
          close={() => setIncident(false)}
          onUpdated={onUpdated}
        />
      )}{" "}
      {needInfo && open && (
        <DecisionDialog
          title="Yêu cầu bổ sung thông tin"
          description="Người dùng có thể trả lời trong cuộc trao đổi riêng."
          min={3}
          max={1000}
          confirmLabel="Gửi yêu cầu"
          onClose={() => setNeedInfo(false)}
          onReload={() => {
            onUpdated();
          }}
          onSubmit={async (note) => {
            await api(`reports/${item.id}/need-more-info`, {
              method: "POST",
              body: { note },
            });
            setNeedInfo(false);
            onUpdated();
          }}
        />
      )}
    </Card>
  );
}
