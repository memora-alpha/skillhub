"use client";
import Link from "next/link";
import { useState } from "react";
import { Badge, Card, DataTable, PageHeader } from "@/components/console/ui";
import { Icon } from "@/components/console/icon";
import { LoadingButton } from "@/components/loading-button";
import { fmtDateTime } from "@/lib/console/format";
import { hasPermission } from "@/lib/staff/permissions";
import { systemCodeLabel } from "@/lib/system-text";
import { AdminNotice, RecordId } from "./admin-ui";
import { DecisionDialog, QueueState } from "./common";
import { useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { filterPanelStyles } from "./admin-filter-panel";

type Restriction = {
  id: string;
  scope: string;
  reasonCode: string;
  startsAt: string;
  endsAt: string;
};

const uuidPattern = "[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}";

export function RestrictionReviews() {
  const { actor } = useStaffSession();
  return hasPermission(actor, "report:moderate") ? (
    <ReviewWorkspace />
  ) : (
    <AdminNotice tone="warn">
      Bạn cần quyền kiểm duyệt báo cáo để xét lại hạn chế uy tín.
    </AdminNotice>
  );
}

function ReviewWorkspace() {
  const { actor, api, portal } = useStaffSession();
  const [userId, setUserId] = useState("");
  const [selected, setSelected] = useState<Restriction>();
  const [decision, setDecision] = useState("APPROVED");
  const [eventId, setEventId] = useState("");
  const [reversing, setReversing] = useState(false);
  const [notice, setNotice] = useState("");
  const resource = useStaffResource<Restriction[]>(
    `reputation/users/${userId}/restriction-reviews`,
    { enabled: !!userId },
  );

  return (
    <div className="stack">
      <PageHeader
        title={portal === "admin" ? "Uy tín & Hạn chế" : "Duyệt gỡ hạn chế"}
        desc="Tra cứu hạn chế hoạt động cần xét lại theo người dùng và xử lý hoàn tác sự kiện uy tín khi có căn cứ."
        actions={
          userId ? (
            <LoadingButton
              type="button"
              className="btn"
              loading={resource.loading}
              onClick={() => void resource.reload()}
            >
              <Icon name="refresh" size={15} />
              Làm mới
            </LoadingButton>
          ) : undefined
        }
      />

      {notice && <output className="staff-success">{notice}</output>}

      <Card title="Tra cứu hạn chế cần xét lại">
        <form
          className={filterPanelStyles.grid}
          onSubmit={(event) => {
            event.preventDefault();
            const value = String(
              new FormData(event.currentTarget).get("userId") ?? "",
            ).trim();
            if (value === userId) void resource.reload();
            else setUserId(value);
          }}
        >
          <label
            className={filterPanelStyles.field}
            style={{ gridColumn: "span 2" }}
          >
            <span>Mã người dùng (UUID)</span>
            <input
              name="userId"
              required
              pattern={uuidPattern}
              defaultValue={userId}
              placeholder="Nhập mã UUID người dùng từ hồ sơ hoặc vụ việc…"
            />
          </label>
          <div className="row">
            <button type="submit" className="btn btn-primary">
              <Icon name="search" size={15} />
              Tra cứu hạn chế
            </button>
            {userId && (
              <button
                type="button"
                className="btn"
                onClick={() => setUserId("")}
              >
                Xóa
              </button>
            )}
          </div>
        </form>
      </Card>

      {userId && (
        <Card
          title="Hạn chế đang chờ quyết định"
          actions={<RecordId id={userId} label="mã người dùng" />}
          flush
        >
          <QueueState
            loading={resource.loading}
            error={resource.error}
            empty={!resource.data?.length}
            reload={resource.reload}
            emptyTitle="Không có hạn chế chờ xét lại"
            emptyDescription="Người dùng này hiện không có hạn chế nào cần nhân sự xem xét."
          >
            <DataTable
              columns={[
                "Phạm vi hạn chế",
                "Lý do ghi nhận",
                "Thời hạn hiệu lực",
                "Thao tác",
              ]}
            >
              {resource.data?.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Badge tone="warn">
                      {systemCodeLabel(row.scope, row.scope)}
                    </Badge>
                    <small>
                      <RecordId id={row.id} label="mã hạn chế" />
                    </small>
                  </td>
                  <td>{systemCodeLabel(row.reasonCode, row.reasonCode)}</td>
                  <td>
                    <div>{fmtDateTime(row.startsAt)}</div>
                    <small>Đến {fmtDateTime(row.endsAt)}</small>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setDecision("APPROVED");
                        setSelected(row);
                      }}
                    >
                      Xét lại hạn chế
                    </button>
                  </td>
                </tr>
              ))}
            </DataTable>
          </QueueState>
        </Card>
      )}

      {actor?.roles.includes("ADMIN") && portal === "admin" && (
        <Card title="Hoàn tác sự kiện uy tín">
          <AdminNotice tone="warn">
            Chỉ hoàn tác sau khi đã đối chiếu mã sự kiện trong hồ sơ vụ việc
            hoặc nhật ký hoạt động. Máy chủ sẽ tự kiểm tra điều kiện và tạo bút
            toán đối ứng.
          </AdminNotice>
          <form
            className={filterPanelStyles.grid}
            onSubmit={(event) => {
              event.preventDefault();
              setReversing(true);
            }}
          >
            <label
              className={filterPanelStyles.field}
              style={{ gridColumn: "span 2" }}
            >
              <span>Mã sự kiện uy tín (UUID)</span>
              <input
                required
                pattern={uuidPattern}
                value={eventId}
                placeholder="Nhập mã UUID sự kiện uy tín cần hoàn tác…"
                onChange={(event) => setEventId(event.target.value.trim())}
              />
            </label>
            <div className="row">
              <button type="submit" className="btn admin-danger-outline">
                <Icon name="restore" size={15} />
                Xem lại & hoàn tác
              </button>
            </div>
          </form>
        </Card>
      )}

      {actor?.roles.includes("ADMIN") && portal !== "admin" && (
        <Card title="Hoàn tác sự kiện uy tín">
          <p className="muted" style={{ marginBottom: 14 }}>
            Thao tác hoàn tác sự kiện uy tín chỉ khả dụng trên cổng Quản trị.
          </p>
          <Link className="btn" href="/admin/reputation">
            Mở cổng Quản trị uy tín →
          </Link>
        </Card>
      )}

      {selected && (
        <DecisionDialog
          title="Ghi nhận xét lại hạn chế"
          description={`Người dùng ${userId}. Việc mở quyền vẫn được máy chủ kiểm tra theo thời hạn và xác nhận chính sách.`}
          min={1}
          max={1000}
          confirmLabel="Ghi nhận quyết định"
          onClose={() => setSelected(undefined)}
          onReload={resource.reload}
          onSubmit={async (reason) => {
            await api(`reputation/restrictions/${selected.id}/review`, {
              method: "POST",
              body: { decision, reason },
            });
            setSelected(undefined);
            setNotice("Đã ghi nhận quyết định xét lại hạn chế.");
            void resource.reload();
          }}
        >
          <label className={filterPanelStyles.field}>
            <span>Quyết định xét lại</span>
            <select
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
            >
              <option value="APPROVED">Chấp thuận kết quả xét lại</option>
              <option value="FOLLOW_UP_REQUIRED">
                Cần theo dõi, xử lý thêm
              </option>
            </select>
          </label>
        </DecisionDialog>
      )}

      {reversing && (
        <DecisionDialog
          title="Hoàn tác sự kiện uy tín"
          description={`Sự kiện ${eventId}. Chỉ xác nhận khi đã đối chiếu nguồn và tác động điểm; hệ thống ghi bút toán đối ứng cùng nhật ký.`}
          min={1}
          max={1000}
          confirmLabel="Xác nhận hoàn tác"
          danger
          onClose={() => setReversing(false)}
          onReload={resource.reload}
          onSubmit={async (reason) => {
            await api(`reputation/events/${eventId}/reverse`, {
              method: "POST",
              body: { reason },
            });
            setReversing(false);
            setEventId("");
            setNotice("Máy chủ đã ghi nhận hoàn tác sự kiện uy tín.");
            void resource.reload();
          }}
        />
      )}
    </div>
  );
}
