"use client";
import Link from "next/link";
import { useState } from "react";
import { Card, PageHeader, StatusBadge } from "@/components/console/ui";
import { useStaffList } from "./hooks";
import { useStaffSession } from "./session";
import { DecisionDialog, Pager, QueueState } from "./common";
import { fmtDateTime } from "@/lib/console/format";
import { IncidentPanel, SeveritySelect } from "./report-incident";
import { severities, type SupportCase } from "./report-support-types";
export { CaseSupportPanel } from "./case-support";
export function SupportQueueScreen() {
  const { portal, api, actor } = useStaffSession();
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [mine, setMine] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [group, setGroup] = useState(false);
  const [incident, setIncident] = useState<string>();
  const [groupSeverity, setGroupSeverity] = useState("MEDIUM");
  const [classify, setClassify] = useState<SupportCase>();
  const params = new URLSearchParams({ limit: "20" });
  if (severity) params.set("severity", severity);
  if (status) params.set("status", status);
  if (mine && actor) params.set("handlerId", actor.userId);
  const list = useStaffList<SupportCase>(`reports/support/queue?${params}`);
  const reset = () => setSelected([]);
  return (
    <>
      <PageHeader
        title="Báo cáo & tranh chấp"
        desc="Ưu tiên vụ việc và trao đổi riêng với các bên."
      />
      <div className="toolbar">
        <label>
          Mức độ
          <select
            className="select"
            value={severity}
            onChange={(e) => {
              setSeverity(e.target.value);
              reset();
            }}
          >
            <option value="">Tất cả</option>
            {severities.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trạng thái
          <select
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              reset();
            }}
          >
            <option value="">Đang mở</option>
            {[
              ["OPEN", "Mới"],
              ["UNDER_REVIEW", "Đang xử lý"],
              ["NEED_MORE_INFO", "Cần bổ sung"],
              ["RESOLVED", "Đã xử lý"],
              ["REJECTED", "Đã bác bỏ"],
            ].map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => {
              setMine(e.target.checked);
              reset();
            }}
          />{" "}
          Tôi phụ trách
        </label>
        <button
          className="btn"
          disabled={selected.length < 2 || selected.length > 100}
          onClick={() => setGroup(true)}
        >
          Gom {selected.length || ""} báo cáo
        </button>
        <button
          className="btn"
          onClick={() => {
            reset();
            void list.reload();
          }}
        >
          Làm mới
        </button>
      </div>
      <Card>
        <QueueState
          loading={list.loading}
          error={list.error}
          empty={!list.items.length}
          reload={list.reload}
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Chọn</th>
                  <th>Mức độ</th>
                  <th>Báo cáo</th>
                  <th>Trạng thái</th>
                  <th>Xử lý</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${r.id}`}
                        disabled={
                          !!r.incidentId ||
                          ["RESOLVED", "REJECTED"].includes(r.status) ||
                          !!(r.handlerId && r.handlerId !== actor?.userId)
                        }
                        checked={selected.includes(r.id)}
                        onChange={(e) =>
                          setSelected((s) =>
                            e.target.checked
                              ? [...s, r.id]
                              : s.filter((id) => id !== r.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      {severities.find((s) => s.code === r.severity)?.label}
                      <button
                        className="btn"
                        onClick={() => {
                          if (r.incidentId) setIncident(r.incidentId);
                          else {
                            setGroupSeverity(r.severity);
                            setClassify(r);
                          }
                        }}
                      >
                        Đổi
                      </button>
                    </td>
                    <td>
                      {r.reasonCode}
                      <small>{fmtDateTime(r.createdAt)}</small>
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      <Link
                        className="link"
                        href={`/${portal}/disputes/${r.id}`}
                      >
                        Chi tiết
                      </Link>
                      {r.incidentId && (
                        <button
                          className="btn"
                          onClick={() => setIncident(r.incidentId!)}
                        >
                          Vụ việc chung
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueueState>
        <Pager
          loading={list.loading}
          more={list.more}
          hasMore={list.page?.hasMore}
        />
      </Card>
      {group && (
        <DecisionDialog
          title="Gom báo cáo cùng vụ việc"
          description="Chỉ gom các báo cáo cùng đối tượng và buổi học. Bạn sẽ phụ trách vụ việc chung."
          min={3}
          max={2000}
          confirmLabel="Gom vụ việc"
          onClose={() => setGroup(false)}
          onReload={list.reload}
          onSubmit={async (reason) => {
            const result = await api<{ id: string }>(
              "reports/support/incidents",
              {
                method: "POST",
                body: { caseIds: selected, severity: groupSeverity, reason },
              },
            );
            setGroup(false);
            reset();
            setIncident(result.data.id);
            await list.reload();
          }}
        >
          <SeveritySelect value={groupSeverity} onChange={setGroupSeverity} />
        </DecisionDialog>
      )}
      {classify && (
        <DecisionDialog
          title="Đổi mức độ báo cáo"
          description="Báo cáo đã gom được đổi qua vụ việc chung."
          min={3}
          max={2000}
          confirmLabel="Lưu mức độ"
          onClose={() => setClassify(undefined)}
          onReload={list.reload}
          onSubmit={async (reason) => {
            await api(`reports/support/cases/${classify.id}/severity`, {
              method: "POST",
              body: {
                severity: groupSeverity,
                expectedVersion: classify.version,
                reason,
              },
            });
            setClassify(undefined);
            await list.reload();
          }}
        >
          <SeveritySelect value={groupSeverity} onChange={setGroupSeverity} />
        </DecisionDialog>
      )}
      {incident && (
        <IncidentPanel
          key={incident}
          id={incident}
          close={() => setIncident(undefined)}
          onUpdated={list.reload}
        />
      )}
    </>
  );
}
