"use client";
import { LoadingButton } from "@/components/loading-button";
import { ListPagination } from "@/components/pagination/list-pagination";
import { useStaffListPages } from "./use-staff-list-pages";
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
import {
  canDescribeStaffPermission,
  staffPermissionPresentation,
} from "@/lib/staff/permission-presentation";
import {
  isStaffDefaultPermission,
  STAFF_PERMISSION_GROUPS,
} from "@/lib/staff/permissions";
import { AdminField, AdminNotice } from "./admin-ui";
import { useStaffResource } from "./hooks";
import { useStaffSession } from "./session";
import { DecisionDialog, QueueState } from "./common";

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
  const users = useStaffListPages<Staff>("users?role=STAFF&limit=20");
  const [userId, setUserId] = useState(initialUserId);
  const [search, setSearch] = useState("");
  const needle = search.trim().toLocaleLowerCase("vi");
  const visible = users.items.filter((user) =>
    `${user.fullName} ${user.maskedEmail}`
      .toLocaleLowerCase("vi")
      .includes(needle),
  );
  const selected = users.allItems.find((user) => user.userId === userId);
  return (
    <section className="ops-permissions">
      <PageHeader
        title="Nhân viên & phân quyền"
        desc="Kiểm soát từng quyền vận hành theo nguyên tắc tách biệt vai trò Staff và Admin (SRS BR-39)."
      />
      <div className="ops-permission-layout">
        <Card className="ops-staff-picker" title="Danh sách nhân viên">
          <SearchBox
            label="Tìm nhân viên trên trang này"
            placeholder="Tên hoặc email đã che…"
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
                    {user.fullName.trim().slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>{user.fullName}</strong>
                    <small>{user.maskedEmail}</small>
                  </span>
                </button>
              ))}
            </div>
            {!visible.length && (
              <p className="muted">Không có kết quả trên trang hiện tại.</p>
            )}
          </QueueState>
          <ListPagination query={users} />
        </Card>
        {userId ? (
          <PermissionEditor key={userId} userId={userId} staff={selected} />
        ) : (
          <Card>
            <Empty
              title="Chọn nhân viên để quản lý quyền"
              desc="Xem nhóm quyền mặc định, quyền mở rộng và các tùy chỉnh GRANT / DENY đang hiệu lực."
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

  const catalogByCode = new Map(
    (catalog.data ?? []).map((item) => [item.code, item]),
  );
  const groupedCodes = new Set<string>(
    STAFF_PERMISSION_GROUPS.flatMap((g) => g.codes),
  );
  const extraCatalogItems = (catalog.data ?? []).filter(
    (item) => !groupedCodes.has(item.code),
  );

  const activeCount = permissions.data
    ? (catalog.data ?? []).filter((item) =>
        permissions.data!.effectivePermissions.includes(item.code),
      ).length
    : 0;
  const totalCatalog = catalog.data?.length ?? 0;
  const overrideCount = permissions.data?.overrides.length ?? 0;

  function renderPermissionRow(permission: Catalog) {
    const text = staffPermissionPresentation(permission.code);
    const override = permissions.data!.overrides.find(
      (row) => row.code === permission.code,
    );
    const allowed = permissions.data!.effectivePermissions.includes(
      permission.code,
    );
    const isDefault = isStaffDefaultPermission(permission.code);

    function overrideLabel() {
      if (override?.effect === "GRANT") return "Đã cấp riêng";
      if (override?.effect === "DENY") return "Đã chặn riêng";
      return "Theo mặc định";
    }

    return (
      <li className="ops-permission-row" key={permission.code}>
        <div>
          <strong>{text.label}</strong>
          <p>{text.description}</p>
          <div className="ops-permission-badges">
            <Badge tone={isDefault ? "info" : "neutral"}>
              {isDefault ? "Mặc định Staff" : "Quyền mở rộng"}
            </Badge>
            <code className="muted" style={{ fontSize: 11.5 }}>
              {permission.code}
            </code>
          </div>
        </div>
        <Badge tone={allowed ? "ok" : "neutral"}>
          {allowed ? "Được phép" : "Không được phép"}
        </Badge>
        <span className="muted">{overrideLabel()}</span>
        <LoadingButton
          type="button"
          className="btn btn-sm"
          disabled={
            permissions.loading || !canDescribeStaffPermission(permission.code)
          }
          aria-label={`Thay đổi quyền ${text.label.toLocaleLowerCase("vi")}`}
          title={
            !canDescribeStaffPermission(permission.code)
              ? text.description
              : undefined
          }
          onClick={() => {
            setCode(permission.code);
            if (override?.effect === "DENY") setEffect("DENY");
            else if (override?.effect === "GRANT") setEffect("GRANT");
            else setEffect("RESET");
            setSaved(false);
            setPassword("");
          }}
          loading={!!permissions.loading}
        >
          Điều chỉnh
        </LoadingButton>
      </li>
    );
  }

  return (
    <Card className="ops-permission-editor">
      <div className="ops-staff-summary">
        <span className="avatar" aria-hidden="true">
          {staff?.fullName.trim().slice(0, 1).toUpperCase() ?? "S"}
        </span>
        <div>
          <h2>{staff?.fullName ?? "Nhân viên đang chọn"}</h2>
          <p className="muted">
            {staff?.maskedEmail ?? `#${userId.slice(0, 8)}`} · Nhân viên vận
            hành
          </p>
        </div>
        {staff?.accountStatus && <StatusBadge status={staff.accountStatus} />}
      </div>

      <AdminNotice tone="warn">
        <strong>Lưu ý bảo mật:</strong> Mọi thay đổi quyền sẽ thu hồi toàn bộ
        phiên đăng nhập hiện tại của nhân viên, yêu cầu xác thực lại bằng mật
        khẩu quản trị viên và ghi nhật ký kiểm tra (Audit Log).
      </AdminNotice>

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
            <div className="admin-summary-strip">
              <AdminField label="Quyền đang hiệu lực">
                <strong>
                  {activeCount}/{totalCatalog} quyền
                </strong>
              </AdminField>
              <AdminField label="Tùy chỉnh riêng (Override)">
                <strong>{overrideCount} mục</strong>
              </AdminField>
              <AdminField label="Phiên bản phân quyền">
                <Badge tone="brand">v{permissions.data.version}</Badge>
              </AdminField>
            </div>

            <div className="ops-permission-heading">
              <div>
                <h3>Ma trận quyền theo phân hệ nghiệp vụ</h3>
                <p className="muted">
                  Staff nhận 9 quyền kiểm duyệt cốt lõi mặc định và có thể được
                  mở rộng thêm 6 quyền xử lý nâng cao.
                </p>
              </div>
              <LoadingButton
                type="button"
                className="btn btn-sm"
                disabled={permissions.loading}
                onClick={() => {
                  void permissions.reload();
                }}
                loading={!!permissions.loading}
              >
                Làm mới
              </LoadingButton>
            </div>

            {STAFF_PERMISSION_GROUPS.map((group) => {
              const items = group.codes
                .map((c) => catalogByCode.get(c))
                .filter((item): item is Catalog => !!item);
              if (!items.length) return null;
              return (
                <section className="ops-permission-group" key={group.id}>
                  <div className="ops-permission-group-head">
                    <h4>{group.title}</h4>
                    <p>{group.description}</p>
                  </div>
                  <ul className="ops-permission-table" aria-label={group.title}>
                    {items.map(renderPermissionRow)}
                  </ul>
                </section>
              );
            })}

            {extraCatalogItems.length > 0 && (
              <section className="ops-permission-group">
                <div className="ops-permission-group-head">
                  <h4>Quyền bổ sung khác</h4>
                  <p>Các quyền khác được máy chủ công bố trong danh mục.</p>
                </div>
                <ul className="ops-permission-table" aria-label="Quyền bổ sung">
                  {extraCatalogItems.map(renderPermissionRow)}
                </ul>
              </section>
            )}

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
                    <strong>{staffPermissionPresentation(code).label}</strong>
                    <p className="muted">
                      {staffPermissionPresentation(code).description}
                    </p>
                  </div>
                  <label className="staff-field">
                    <span>Thay đổi</span>
                    <select
                      className="select"
                      value={effect}
                      onChange={(e) => setEffect(e.target.value)}
                    >
                      <option value="GRANT">Cho phép (GRANT)</option>
                      <option value="DENY">Chặn riêng (DENY)</option>
                      <option value="RESET">Khôi phục mặc định (RESET)</option>
                    </select>
                  </label>
                  <label className="staff-field">
                    <span>Mật khẩu quản trị viên</span>
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
        <output className="staff-success">Đã cập nhật quyền nhân viên.</output>
      )}
    </Card>
  );
}
