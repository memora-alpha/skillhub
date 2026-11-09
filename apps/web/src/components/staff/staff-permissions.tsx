"use client";
import { useState } from "react";
import { Card, PageHeader } from "@/components/console/ui";
import { PasswordInput } from "@/components/password-input";
import { useStaffList, useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { useOperation } from "./operation-tools";
import { Pager, QueueState } from "./common";
type Staff = { userId: string; fullName: string; maskedEmail: string };
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
  return (
    <>
      <PageHeader
        title="Quyền nhân viên"
        desc="Cấp, chặn hoặc khôi phục quyền mặc định."
      />
      <Card>
        <QueueState
          loading={users.loading}
          error={users.error}
          empty={!users.items.length}
          reload={users.reload}
        >
          <label>
            Nhân viên
            <select
              className="select"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Chọn nhân viên</option>
              {userId && !users.items.some((u) => u.userId === userId) && (
                <option value={userId}>Nhân viên đang chọn</option>
              )}
              {users.items.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.fullName} · {u.maskedEmail}
                </option>
              ))}
            </select>
          </label>
        </QueueState>
        <Pager
          loading={users.loading}
          more={users.more}
          hasMore={users.page?.hasMore}
        />
      </Card>
      {userId && <PermissionEditor key={userId} userId={userId} />}
    </>
  );
}
function PermissionEditor({ userId }: Readonly<{ userId: string }>) {
  const { api } = useStaffSession();
  const catalog = useStaffResource<Catalog[]>("staff-permissions/catalog");
  const permissions = useStaffResource<Permissions>(
    `staff-permissions/${userId}`,
  );
  const [code, setCode] = useState("");
  const [effect, setEffect] = useState("GRANT");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const operation = useOperation();
  return (
    <Card>
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
            <h2>Quyền hiệu lực</h2>
            <button
              className="btn"
              disabled={operation.busy || permissions.loading}
              onClick={() => {
                void permissions.reload();
              }}
            >
              Làm mới quyền
            </button>
            <ul>
              {catalog.data.map((p) => (
                <li key={p.code}>
                  {p.description || p.code} ·{" "}
                  {permissions.data!.effectivePermissions.includes(p.code)
                    ? "Được phép"
                    : "Không được phép"}
                  {permissions.data!.overrides.find((o) => o.code === p.code) &&
                    " (đã tùy chỉnh)"}
                </li>
              ))}
            </ul>
            <form
              className="staff-termination-form"
              onSubmit={(e) => {
                e.preventDefault();
                void operation.run(async () => {
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
                        reason: reason.trim(),
                        expectedVersion: permissions.data!.version,
                        reauthToken: auth.data.reauthToken,
                      },
                    },
                  );
                  await permissions.reload();
                });
              }}
            >
              <fieldset disabled={operation.busy || permissions.loading}>
                <label>
                  Quyền
                  <select
                    className="select"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  >
                    <option value="">Chọn quyền</option>
                    {catalog.data.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.description || p.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Thay đổi
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
                <label>
                  Lý do
                  <textarea
                    required
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <label>
                  Mật khẩu Admin
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </label>
                <p className="muted">
                  Nhân viên cần đăng nhập lại sau thay đổi.
                </p>
                <button
                  className="btn btn-primary"
                  disabled={!reason.trim()}
                  type="submit"
                >
                  Lưu quyền
                </button>
              </fieldset>
            </form>
          </>
        )}
      </QueueState>
      {operation.feedback}
    </Card>
  );
}
