"use client";

import Link from "next/link";
import { useState } from "react";
import { useConsole } from "./context";
import { Icon } from "./icon";
import { ReasonDialog } from "./reason-dialog";
import {
  Card,
  Empty,
  GatedButton,
  Notice,
  PageHeader,
  StatusBadge,
} from "./ui";
import type { RoleCode } from "@/lib/console/data";
import { fmtDate, fmtDateTime, fmtNum } from "@/lib/console/format";

type Action =
  | { kind: "lock" }
  | { kind: "unlock" }
  | { kind: "grant"; role: RoleCode }
  | { kind: "revoke"; role: RoleCode };

export function UserDetail({ id }: { id: string }) {
  const { users, updateUser, can, record, audit, actor } = useConsole();
  const [action, setAction] = useState<Action | null>(null);
  const [grantRole, setGrantRole] = useState<RoleCode>("STAFF");
  const user = users.find((u) => u.id === id);

  const back = (
    <Link className="back-link" href="/admin/users">
      <Icon name="left" size={14} /> Danh sách người dùng
    </Link>
  );

  if (!user) {
    return (
      <>
        <PageHeader title="Không tìm thấy người dùng" back={back} />
        <Card>
          <Empty
            title="Người dùng không tồn tại"
            desc={`Mã ${id} không có trong hệ thống.`}
          />
        </Card>
      </>
    );
  }

  // The signed-in admin can never lock or re-role themselves.
  const self = user.name === actor.name;
  const locked = user.status === "LOCKED";
  const canToggle =
    !self &&
    (user.status === "ACTIVE" || user.status === "SUSPENDED" || locked);
  const grantable = (["STAFF", "ADMIN"] as RoleCode[]).filter(
    (r) => !user.roles.includes(r),
  );
  const pick = grantable.includes(grantRole)
    ? grantRole
    : (grantable[0] ?? "STAFF");
  const trail = audit.filter((a) => a.target === `USER:${user.id}`);

  function confirm(reason: string) {
    if (!action || !user) return;
    if (action.kind === "lock" || action.kind === "unlock") {
      const next = action.kind === "lock" ? "LOCKED" : "ACTIVE";
      updateUser(user.id, { status: next });
      record({
        action: action.kind === "lock" ? "USER_LOCK" : "USER_UNLOCK",
        target: `USER:${user.id}`,
        reason,
        before: user.status,
        after: next,
      });
    } else {
      const roles =
        action.kind === "grant"
          ? [...user.roles, action.role]
          : user.roles.filter((r) => r !== action.role);
      updateUser(user.id, { roles });
      record({
        action: "ROLE_PERMISSION_CHANGE",
        target: `USER:${user.id}`,
        reason,
        before: user.roles.join(", "),
        after: roles.join(", "),
      });
    }
    setAction(null);
  }

  const dialog = {
    lock: {
      title: "Khóa tài khoản",
      confirm: "Khóa tài khoản",
      tone: "danger" as const,
    },
    unlock: {
      title: "Mở khóa tài khoản",
      confirm: "Mở khóa",
      tone: "primary" as const,
    },
    grant: {
      title: "Cấp role",
      confirm: "Cấp quyền",
      tone: "primary" as const,
    },
    revoke: {
      title: "Thu hồi role",
      confirm: "Thu hồi",
      tone: "danger" as const,
    },
  };

  return (
    <>
      <PageHeader
        title={user.name}
        desc={user.email}
        back={back}
        actions={
          <>
            <StatusBadge status={user.status} />
            <GatedButton
              allowed={can("user.lock") && canToggle}
              className={locked ? "btn" : "btn btn-danger"}
              title={self ? "Không thể khóa chính mình" : undefined}
              onClick={() => setAction({ kind: locked ? "unlock" : "lock" })}
            >
              <Icon name={locked ? "unlock" : "lock"} size={16} />
              {locked ? "Mở khóa" : "Khóa tài khoản"}
            </GatedButton>
          </>
        }
      />
      <div className="grid grid-main">
        <div className="stack">
          <Card title="Hồ sơ">
            <dl className="kv">
              <dt>Mã người dùng</dt>
              <dd className="mono">{user.id}</dd>
              <dt>Tham gia</dt>
              <dd>{fmtDate(user.joinedAt)}</dd>
              <dt>Hoạt động gần nhất</dt>
              <dd>{fmtDateTime(user.lastActiveAt)}</dd>
              <dt>Kỹ năng chia sẻ</dt>
              <dd>{user.skills}</dd>
              <dt>Báo cáo đang mở</dt>
              <dd>{user.openReports}</dd>
            </dl>
          </Card>
          <Card title="Lịch sử Audit của người dùng này" flush>
            {trail.length === 0 ? (
              <Empty title="Chưa có thao tác nào" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Hành động</th>
                      <th>Thực hiện bởi</th>
                      <th>Lý do</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trail.map((a) => (
                      <tr key={a.id}>
                        <td className="muted">{fmtDateTime(a.at)}</td>
                        <td className="mono">{a.action}</td>
                        <td>{a.actor}</td>
                        <td>{a.reason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title="Chỉ số">
            <dl className="kv">
              <dt>Uy tín</dt>
              <dd>
                <strong>{user.reputation}</strong> / 100
              </dd>
              <dt>Số dư Credit</dt>
              <dd>
                <strong>{fmtNum(user.credit)}</strong>
              </dd>
            </dl>
          </Card>
          <Card title="Role & quyền">
            <div className="stack">
              <div className="chips">
                {user.roles.map((r) => (
                  <span key={r} className="chip">
                    {r}
                    {r !== "USER" && (
                      <button
                        className="icon-btn"
                        aria-label={`Thu hồi role ${r}`}
                        disabled={!can("user.role") || self}
                        onClick={() => setAction({ kind: "revoke", role: r })}
                      >
                        <Icon name="x" size={12} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {self ? (
                <Notice tone="info">
                  Bạn không thể thay đổi role của chính mình.
                </Notice>
              ) : grantable.length === 0 ? (
                <span className="muted">Đã có đủ các role có thể cấp.</span>
              ) : (
                <div className="row">
                  <label>
                    <span className="sr-only">Role cần cấp</span>
                    <select
                      className="select"
                      value={pick}
                      onChange={(e) => setGrantRole(e.target.value as RoleCode)}
                    >
                      {grantable.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  <GatedButton
                    allowed={can("user.role")}
                    className="btn btn-primary"
                    onClick={() => setAction({ kind: "grant", role: pick })}
                  >
                    <Icon name="plus" size={16} /> Cấp role
                  </GatedButton>
                </div>
              )}
              <p className="hint">
                Staff là role tách biệt, không mặc định kế thừa quyền Admin.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {action && (
        <ReasonDialog
          title={dialog[action.kind].title}
          description={
            "role" in action
              ? `${action.role} — ${user.name}`
              : `${user.name} (${user.email})`
          }
          confirmLabel={dialog[action.kind].confirm}
          tone={dialog[action.kind].tone}
          onClose={() => setAction(null)}
          onConfirm={confirm}
        />
      )}
    </>
  );
}
