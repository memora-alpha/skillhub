"use client";
import { useState } from "react";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  SearchBox,
  StatusBadge,
} from "@/components/console/ui";
import { PasswordInput } from "@/components/password-input";
import { useStaffList, useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { DecisionDialog, Pager, QueueState } from "./common";
type Staff = {
  userId: string;
  fullName: string;
  maskedEmail: string;
  accountStatus?: string;
};
type Catalog = { code: string; description: string | null };
type Permissions = {
  version: number;
  effectivePermissions: string[];
  overrides: { code: string; effect: string }[];
};
export function StaffPermissionsScreen({
  initialUserId = "",
}: Readonly<{ initialUserId?: string }>) {
  const users = useStaffList<Staff>("users?role=STAFF&limit=20");
  const [userId, setUserId] = useState(initialUserId);
  const [search, setSearch] = useState("");
  const needle = search.trim().toLocaleLowerCase("vi");
  const visible = users.items.filter((user) =>
    `${user.fullName} ${user.maskedEmail}`
      .toLocaleLowerCase("vi")
      .includes(needle),
  );
  const selected = users.items.find((user) => user.userId === userId);
  return (
    <section className="ops-permissions">
      <PageHeader
        title="Quyền nhân viên"
        desc="Xem quyền hiệu lực và điều chỉnh quyền cho từng tài khoản Staff."
      />
      <div className="ops-permission-layout">
        <Card className="ops-staff-picker" title="Nhân viên">
          <SearchBox
            label="Tìm trong nhân viên đã tải"
            placeholder="Tìm trong nhân viên đã tải…"
            value={search}
            onChange={setSearch}
          />
          <QueueState
            loading={users.loading}
            error={users.error}
            empty={!users.items.length}
            reload={users.reload}
          >
            <div className="ops-staff-list">
              {visible.map((user) => (
                <button
                  type="button"
                  key={user.userId}
                  data-selected={userId === user.userId}
                  aria-pressed={userId === user.userId}
                  onClick={() => setUserId(user.userId)}
                >
                  <span className="avatar" aria-hidden="true">
                    {user.fullName.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{user.fullName}</strong>
                    <small>{user.maskedEmail}</small>
                  </span>
                </button>
              ))}
            </div>
            {!visible.length && (
              <p className="muted">
                Không có kết quả trong các nhân viên đã tải.
              </p>
            )}
          </QueueState>
          <Pager
            loading={users.loading}
            more={users.more}
            hasMore={users.page?.hasMore}
          />
        </Card>
        {userId ? (
          <PermissionEditor key={userId} userId={userId} staff={selected} />
        ) : (
          <Card>
            <Empty
              title="Chọn nhân viên để xem quyền"
              desc="Quyền hiệu lực và các tùy chỉnh sẽ xuất hiện tại đây."
            />
          </Card>
        )}
      </div>
    </section>
  );
}
function PermissionEditor({
  userId,
  staff,
}: Readonly<{ userId: string; staff?: Staff }>) {
  const { api } = useStaffSession();
  const catalog = useStaffResource<Catalog[]>("staff-permissions/catalog");
  const permissions = useStaffResource<Permissions>(
    `staff-permissions/${userId}`,
  );
  const [code, setCode] = useState("");
  const [effect, setEffect] = useState("GRANT");
  const [password, setPassword] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <Card className="ops-permission-editor">
      <div className="ops-staff-summary">
        <span className="avatar" aria-hidden="true">
          {staff?.fullName.slice(0, 1) ?? "S"}
        </span>
        <div>
          <h2>{staff?.fullName ?? "Nhân viên đang chọn"}</h2>
          <p className="muted">
            {staff?.maskedEmail ?? `#${userId.slice(0, 8)}`} · Staff
          </p>
        </div>
        {staff?.accountStatus && <StatusBadge status={staff.accountStatus} />}
      </div>
      <p className="staff-flag">
        Thay đổi quyền sẽ thu hồi các phiên hiện tại của nhân viên. Mỗi thay đổi
        cần xác thực lại bằng mật khẩu Admin.
      </p>
      <QueueState
        loading={permissions.loading || catalog.loading}
        error={permissions.error || catalog.error}
        empty={!permissions.data || !catalog.data}
        reload={() => {
          void permissions.reload();
          void catalog.reload();
        }}
      >
        {permissions.data && catalog.data && (
          <>
            <div className="ops-permission-heading">
              <div>
                <h3>Quyền hiệu lực</h3>
                <p className="muted">Theo vai trò và tùy chỉnh hiện tại.</p>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                disabled={permissions.loading}
                onClick={() => {
                  void permissions.reload();
                }}
              >
                Cập nhật quyền
              </button>
            </div>
            <div
              className="ops-permission-table"
              role="list"
              aria-label="Danh mục quyền nhân viên"
            >
              {catalog.data.map((permission) => {
                const override = permissions.data!.overrides.find(
                  (row) => row.code === permission.code,
                );
                const allowed = permissions.data!.effectivePermissions.includes(
                  permission.code,
                );
                return (
                  <div
                    className="ops-permission-row"
                    role="listitem"
                    key={permission.code}
                  >
                    <div>
                      <code>{permission.code}</code>
                      <p>{permission.description || "Quyền nghiệp vụ"}</p>
                    </div>
                    <Badge tone={allowed ? "ok" : "neutral"}>
                      {allowed ? "Được phép" : "Không được phép"}
                    </Badge>
                    <span className="muted">
                      {override?.effect === "GRANT"
                        ? "Đã cấp riêng"
                        : override?.effect === "DENY"
                          ? "Đã chặn riêng"
                          : "Theo mặc định"}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={permissions.loading}
                      onClick={() => {
                        setCode(permission.code);
                        setEffect(
                          override?.effect === "DENY"
                            ? "DENY"
                            : override?.effect === "GRANT"
                              ? "GRANT"
                              : "RESET",
                        );
                        setSaved(false);
                        setPassword("");
                      }}
                    >
                      Thay đổi
                    </button>
                  </div>
                );
              })}
            </div>
            {code && (
              <DecisionDialog
                key={code}
                presentation="drawer"
                title="Điều chỉnh quyền nhân viên"
                description="Thay đổi sẽ thu hồi các phiên hiện tại của nhân viên. Kiểm tra quyền và lựa chọn trước khi xác nhận."
                min={1}
                max={1000}
                confirmLabel="Lưu quyền"
                onClose={() => {
                  setCode("");
                  setPassword("");
                }}
                onReload={() => {
                  void permissions.reload();
                }}
                onSubmit={async (reason) => {
                  const auth = await api<{ reauthToken: string }>(
                    "reauthenticate",
                    {
                      method: "POST",
                      body: { password, purpose: "STAFF_ROLE_CHANGE" },
                    },
                  );
                  setPassword("");
                  await api(
                    `staff-permissions/${userId}/${encodeURIComponent(code)}`,
                    {
                      method: "PUT",
                      body: {
                        effect,
                        reason,
                        expectedVersion: permissions.data!.version,
                        reauthToken: auth.data.reauthToken,
                      },
                    },
                  );
                  setSaved(true);
                  await permissions.reload();
                }}
              >
                <div className="stack">
                  <div>
                    <strong>
                      {catalog.data.find((row) => row.code === code)
                        ?.description ?? "Quyền nghiệp vụ"}
                    </strong>
                    <p className="mono">{code}</p>
                  </div>
                  <label className="staff-field">
                    <span>Thay đổi</span>
                    <select
                      className="select"
                      value={effect}
                      onChange={(e) => setEffect(e.target.value)}
                    >
                      <option value="GRANT">Cho phép</option>
                      <option value="DENY">Chặn</option>
                      <option value="RESET">Theo mặc định</option>
                    </select>
                  </label>
                  <label className="staff-field">
                    <span>Mật khẩu Admin</span>
                    <PasswordInput
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      maxLength={64}
                      autoComplete="current-password"
                    />
                  </label>
                </div>
              </DecisionDialog>
            )}
          </>
        )}
      </QueueState>
      {saved && (
        <p className="staff-success" role="status">
          Đã cập nhật quyền nhân viên.
        </p>
      )}
    </Card>
  );
}
