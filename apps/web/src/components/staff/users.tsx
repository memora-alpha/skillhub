"use client";
import { useState } from "react";
import {
  Avatar,
  Badge,
  Card,
  Empty,
  PageHeader,
  SearchBox,
  StatusBadge,
} from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import type { AdminUser } from "@/lib/staff/admin-types";
import { useStaffList } from "./hooks";
import { useStaffSession } from "./session";
import { DecisionDialog, Pager, QueueState } from "./common";
type Action = "lock" | "unlock" | "assign" | "remove";
const labels: Record<Action, string> = {
  lock: "Khóa tài khoản",
  unlock: "Mở khóa tài khoản",
  assign: "Cấp quyền Staff",
  remove: "Gỡ quyền Staff",
};
export function UsersScreen({ initialUserId }: { initialUserId?: string }) {
  const { api, actor } = useStaffSession();
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialUserId ?? null,
  );
  const [action, setAction] = useState<Action | null>(null);
  const [password, setPassword] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const params = new URLSearchParams({ limit: "20" });
  if (status) params.set("status", status);
  if (role) params.set("role", role);
  const queue = useStaffList<AdminUser>(`users?${params}`);
  const selected = queue.items.find((u) => u.userId === selectedId);
  const rows = queue.items.filter((u) =>
    `${u.fullName} ${u.maskedEmail} ${u.userId}`
      .toLocaleLowerCase("vi")
      .includes(q.trim().toLocaleLowerCase("vi")),
  );
  const reset = () => {
    setSelectedId(null);
    setAction(null);
    setSuccess(null);
  };
  const reload = async () => {
    setAction(null);
    setPassword("");
    await queue.reload();
  };
  return (
    <>
      <PageHeader
        title="Người dùng"
        desc="Quản lý trạng thái tài khoản và phân quyền nhân viên."
        actions={
          <button className="btn" disabled={queue.loading} onClick={reload}>
            Làm mới
          </button>
        }
      />
      <div className="toolbar">
        <SearchBox
          label="Tìm trong người dùng đã tải"
          placeholder="Tên, email đã che hoặc mã…"
          value={q}
          onChange={setQ}
        />
        <label>
          <span className="sr-only">Vai trò</span>
          <select
            className="select"
            value={role}
            onChange={(e) => {
              reset();
              setRole(e.target.value);
            }}
          >
            <option value="">Mọi vai trò</option>
            {["USER", "STAFF", "ADMIN"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Trạng thái</span>
          <select
            className="select"
            value={status}
            onChange={(e) => {
              reset();
              setStatus(e.target.value);
            }}
          >
            <option value="">Mọi trạng thái</option>
            {[
              "ACTIVE",
              "LOCKED",
              "PENDING_VERIFICATION",
              "SUSPENDED",
              "DEACTIVATED",
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      {success && (
        <p className="staff-success" role="status">
          {success}
        </p>
      )}
      <Card flush>
        <QueueState
          loading={queue.loading}
          error={queue.error}
          empty={!queue.items.length}
          reload={queue.reload}
        >
          {!rows.length ? (
            <Empty title="Không có kết quả trong danh sách đã tải" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Người dùng</th>
                    <th>Vai trò</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.userId}>
                      <td>
                        <div className="cell-user">
                          <Avatar name={u.fullName || "Người dùng"} />
                          <div>
                            <button
                              className="link"
                              onClick={() => {
                                setSelectedId(u.userId);
                                setSuccess(null);
                              }}
                            >
                              {u.fullName || "Chưa có tên"}
                            </button>
                            <span>{u.maskedEmail}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {u.roles.map((r) => (
                          <StatusBadge key={r} status={r} />
                        ))}
                      </td>
                      <td>
                        <StatusBadge status={u.accountStatus} />
                      </td>
                      <td>{fmtDateTime(u.createdAt)}</td>
                      <td>
                        <button
                          className="btn btn-sm"
                          onClick={() => setSelectedId(u.userId)}
                        >
                          Quản lý
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueueState>
        <div className="table-foot">
          {queue.items.length} người dùng đã tải · Tìm kiếm trong các trang đã
          tải
        </div>
        <Pager
          loading={queue.loading}
          more={queue.more}
          hasMore={queue.page?.hasMore}
        />
      </Card>
      {selectedId && !selected && !queue.loading && !queue.error && (
        <Card className="section">
          <p>
            Tài khoản được chọn chưa có trong danh sách đã tải. Tải thêm hoặc
            đổi bộ lọc để tìm tài khoản.
          </p>
          <Pager
            loading={queue.loading}
            more={queue.more}
            hasMore={queue.page?.hasMore}
          />
        </Card>
      )}
      {selected && (
        <Card
          className="section"
          title={selected.fullName || "Tài khoản"}
          actions={
            <button className="btn btn-sm" onClick={() => setSelectedId(null)}>
              Đóng chi tiết
            </button>
          }
        >
          <div className="stack">
            <div className="row">
              <StatusBadge status={selected.accountStatus} />
              {selected.roles.map((r) => (
                <StatusBadge key={r} status={r} />
              ))}
              {selected.userId === actor?.userId && (
                <Badge>Tài khoản của bạn</Badge>
              )}
            </div>
            <dl className="kv staff-kv">
              <dt>Mã tài khoản</dt>
              <dd className="mono">{selected.userId}</dd>
              <dt>Email</dt>
              <dd>{selected.maskedEmail}</dd>
              <dt>Ngày tạo</dt>
              <dd>{fmtDateTime(selected.createdAt)}</dd>
            </dl>
            <div className="row">
              {selected.accountStatus === "ACTIVE" && (
                <button
                  className="btn btn-danger"
                  disabled={
                    selected.userId === actor?.userId ||
                    !!action ||
                    queue.loading
                  }
                  onClick={() => setAction("lock")}
                >
                  Khóa tài khoản
                </button>
              )}
              {selected.accountStatus === "LOCKED" && (
                <button
                  className="btn"
                  disabled={!!action || queue.loading}
                  onClick={() => setAction("unlock")}
                >
                  Mở khóa
                </button>
              )}
              {!selected.roles.includes("ADMIN") && (
                <button
                  className="btn btn-primary"
                  disabled={!!action || queue.loading}
                  onClick={() => {
                    setPassword("");
                    setAction(
                      selected.roles.includes("STAFF") ? "remove" : "assign",
                    );
                  }}
                >
                  {selected.roles.includes("STAFF")
                    ? "Gỡ quyền Staff"
                    : "Cấp quyền Staff"}
                </button>
              )}
            </div>
          </div>
        </Card>
      )}
      {selected && action && (
        <DecisionDialog
          title={labels[action]}
          description={
            action === "lock"
              ? "Tài khoản sẽ bị khóa và toàn bộ phiên đăng nhập bị thu hồi."
              : action === "unlock"
                ? "Tài khoản đã xác minh sẽ hoạt động trở lại. Người dùng cần đăng nhập lại."
                : `Thay đổi vai trò của ${selected.fullName || selected.maskedEmail}. Nhập lại mật khẩu Admin để xác nhận.`
          }
          min={1}
          max={1000}
          confirmLabel={labels[action]}
          danger={action === "lock" || action === "remove"}
          onClose={() => {
            setAction(null);
            setPassword("");
          }}
          onReload={reload}
          onSubmit={async (reason) => {
            if (action === "lock" || action === "unlock")
              await api<null>(`users/${selected.userId}/${action}`, {
                method: "POST",
                body: { reason },
              });
            else {
              const proof = await api<{ reauthToken: string }>(
                "reauthenticate",
                {
                  method: "POST",
                  body: { password, purpose: "STAFF_ROLE_CHANGE" },
                },
              );
              setPassword("");
              await api<null>(`users/${selected.userId}/roles/staff`, {
                method: action === "assign" ? "PUT" : "DELETE",
                body: { reason, reauthToken: proof.data.reauthToken },
              });
            }
            setSuccess(`${labels[action]} thành công.`);
            await reload();
          }}
        >
          {(action === "assign" || action === "remove") && (
            <label className="staff-field">
              Mật khẩu Admin
              <input
                type="password"
                required
                autoComplete="current-password"
                maxLength={64}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
        </DecisionDialog>
      )}
    </>
  );
}
