"use client";
import { useState } from "react";
import { Card } from "@/components/console/ui";
import { hasPermission } from "@/lib/staff/permissions";
import { useStaffSession } from "./session";
import { DecisionDialog } from "./common";
import { Identifier } from "./operation-tools";
import type { ReportCaseDetail } from "@/lib/staff/types";
import {
  assertReportEditable,
  isSystemReport,
} from "@/lib/staff/report-access";
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
  const canCommunicate = hasPermission(actor, "report:communicate");
  const canGroup = hasPermission(actor, "report:group");

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
  const readOnly = isSystemReport(item);
  const open =
    !readOnly &&
    ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"].includes(item.status);

  return (
    <Card className="admin-case-support" title="Trao đổi riêng & vụ việc chung">
      {!owns ? (
        <p className="muted">
          {readOnly
            ? "Trao đổi riêng chỉ hiển thị cho người được giao xử lý."
            : "Nhận xử lý báo cáo để mở luồng trao đổi riêng với các bên liên quan."}
        </p>
      ) : !canCommunicate ? (
        <div className="stack">
          <p className="muted">
            Tài khoản của bạn chưa được cấp quyền trao đổi riêng trong vụ việc (
            <code>report:communicate</code>). Liên hệ quản trị viên nếu cần mở
            quyền này.
          </p>
          {open && (
            <div className="row">
              <button
                type="button"
                className="btn"
                onClick={() => setNeedInfo(true)}
              >
                Yêu cầu bổ sung thông tin
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="stack">
          <fieldset
            className="admin-party-tabs"
            aria-label="Chọn bên trao đổi riêng"
          >
            {parties.map((id) => {
              function partyLabel() {
                if (id === item.session?.teacherId) {
                  return "Người dạy" as const;
                }
                if (id === item.session?.learnerId) {
                  return "Người học" as const;
                }
                if (id === item.reporterId) {
                  return "Người báo cáo" as const;
                }
                return "Bên liên quan" as const;
              }
              return (
                <button
                  type="button"
                  key={id}
                  className="btn btn-sm"
                  aria-pressed={party === id}
                  onClick={() => setParty(id)}
                >
                  {partyLabel()} · {id.slice(0, 8)}
                </button>
              );
            })}
          </fieldset>
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
                <button type="submit" className="btn btn-sm">
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
              readOnlyMessage={
                readOnly
                  ? "Báo cáo hệ thống chỉ cho phép xem lịch sử trao đổi."
                  : undefined
              }
            />
          )}
          {open && (
            <div className="row">
              <button
                type="button"
                className="btn"
                onClick={() => setNeedInfo(true)}
              >
                Yêu cầu bổ sung thông tin
              </button>
            </div>
          )}
        </div>
      )}

      {item.incidentId && canGroup && (
        <div className="row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn"
            onClick={() => setIncident(true)}
          >
            {readOnly ? "Xem vụ việc chung" : "Mở quyết định vụ việc chung"}
          </button>
        </div>
      )}
      {incident && item.incidentId && canGroup && (
        <IncidentPanel
          id={item.incidentId}
          close={() => setIncident(false)}
          onUpdated={onUpdated}
          readOnly={readOnly}
        />
      )}
      {needInfo && open && (
        <DecisionDialog
          title="Yêu cầu bổ sung thông tin"
          description="Người dùng có thể trả lời và đính kèm bằng chứng trong cuộc trao đổi riêng."
          min={3}
          max={1000}
          confirmLabel="Gửi yêu cầu"
          onClose={() => setNeedInfo(false)}
          onReload={() => {
            onUpdated();
          }}
          onSubmit={async (note) => {
            assertReportEditable(item);
            const fresh = await api<ReportCaseDetail>(`reports/${item.id}`);
            assertReportEditable(fresh.data);
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
