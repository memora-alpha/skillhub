"use client";
import { systemCodeLabel } from "@/lib/system-text";
import { useState } from "react";
import { Card, PageHeader } from "@/components/console/ui";
import { Identifier, useOperation } from "./operation-tools";
import { useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { DecisionDialog, QueueState } from "./common";
import { fmtDateTime } from "@/lib/console/format";
type Restriction = {
  id: string;
  scope: string;
  reasonCode: string;
  startsAt: string;
  endsAt: string;
};
export function RestrictionReviewsScreen({
  initialUserId = "",
}: Readonly<{ initialUserId?: string }>) {
  const { portal, api } = useStaffSession();
  const [draft, setDraft] = useState(initialUserId);
  const [userId, setUserId] = useState(initialUserId);
  const [historyId, setHistoryId] = useState("");
  const [reason, setReason] = useState("");
  const operation = useOperation();
  return (
    <>
      <PageHeader
        title="Xét lại uy tín"
        desc="Xem hạn chế và ghi nhận quyết định xử lý."
      />
      <Card>
        <form
          className="toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            setUserId(draft);
          }}
        >
          <Identifier value={draft} onChange={setDraft} />
          <button className="btn" type="submit">
            Tra cứu
          </button>
        </form>
        {userId && <PendingReviews key={userId} userId={userId} />}
      </Card>
      {portal === "admin" && (
        <Card>
          <details>
            <summary>Đảo sự kiện uy tín</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void operation.run(() =>
                  api(`reputation/events/${historyId}/reverse`, {
                    method: "POST",
                    body: { reason: reason.trim() },
                  }),
                );
              }}
            >
              <fieldset disabled={operation.busy}>
                <Identifier
                  label="Mã sự kiện uy tín"
                  value={historyId}
                  onChange={setHistoryId}
                />
                <label>
                  Lý do
                  <textarea
                    required
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button className="btn" type="submit" disabled={!reason.trim()}>
                  Đảo sự kiện
                </button>
              </fieldset>
            </form>
            {operation.feedback}
          </details>
        </Card>
      )}
    </>
  );
}
function PendingReviews({ userId }: Readonly<{ userId: string }>) {
  const { api } = useStaffSession();
  const resource = useStaffResource<Restriction[]>(
    `reputation/users/${userId}/restriction-reviews`,
  );
  const [selected, setSelected] = useState<{
    restriction: Restriction;
    decision: string;
  }>();
  return (
    <QueueState
      loading={resource.loading}
      error={resource.error}
      empty={!resource.data?.length}
      reload={resource.reload}
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Hạn chế</th>
              <th>Thời hạn</th>
              <th>Quyết định</th>
            </tr>
          </thead>
          <tbody>
            {resource.data?.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.scope === "REQUIRE_ADMIN_REVIEW"
                    ? "Cần Admin xét"
                    : "Cần Staff xét"}
                  <small>{systemCodeLabel(r.reasonCode)}</small>
                </td>
                <td>
                  {fmtDateTime(r.startsAt)} — {fmtDateTime(r.endsAt)}
                </td>
                <td>
                  <button
                    className="btn"
                    onClick={() =>
                      setSelected({ restriction: r, decision: "APPROVED" })
                    }
                  >
                    Chấp thuận
                  </button>
                  <button
                    className="btn"
                    onClick={() =>
                      setSelected({
                        restriction: r,
                        decision: "FOLLOW_UP_REQUIRED",
                      })
                    }
                  >
                    Cần theo dõi
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <DecisionDialog
          title={
            selected.decision === "APPROVED"
              ? "Chấp thuận xét lại"
              : "Yêu cầu theo dõi"
          }
          description="Ghi lý do để người dùng hiểu quyết định."
          min={1}
          max={1000}
          confirmLabel="Lưu quyết định"
          onClose={() => setSelected(undefined)}
          onReload={resource.reload}
          onSubmit={async (reason) => {
            await api(
              `reputation/restrictions/${selected.restriction.id}/review`,
              { method: "POST", body: { decision: selected.decision, reason } },
            );
            setSelected(undefined);
            await resource.reload();
          }}
        />
      )}
    </QueueState>
  );
}
