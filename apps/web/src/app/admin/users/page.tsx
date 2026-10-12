"use client";

import Link from "next/link";
import { useState } from "react";
import { useConsole } from "@/components/console/context";
import {
  Avatar,
  Card,
  Empty,
  PageHeader,
  SearchBox,
  StatusBadge,
} from "@/components/console/ui";
import type { AccountStatus, RoleCode } from "@/lib/console/data";
import { fmtDate, fmtNum } from "@/lib/console/format";

const STATUSES: AccountStatus[] = [
  "ACTIVE",
  "PENDING_VERIFICATION",
  "SUSPENDED",
  "LOCKED",
  "DEACTIVATED",
];
const ROLES: RoleCode[] = ["USER", "STAFF", "ADMIN"];

export default function AdminUsersPage() {
  const { users } = useConsole();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleCode | "">("");
  const [status, setStatus] = useState<AccountStatus | "">("");

  const q = query.trim().toLowerCase();
  const rows = users.filter(
    (u) =>
      (!q || `${u.name} ${u.email} ${u.id}`.toLowerCase().includes(q)) &&
      (!role || u.roles.includes(role)) &&
      (!status || u.status === status),
  );

  return (
    <>
      <PageHeader
        title="Người dùng"
        desc="Tìm kiếm, xem chi tiết, khóa hoặc mở khóa tài khoản và cấp role."
      />
      <div className="toolbar">
        <SearchBox
          label="Tìm người dùng"
          placeholder="Tên, email hoặc mã…"
          value={query}
          onChange={setQuery}
        />
        <label>
          <span className="sr-only">Lọc theo role</span>
          <select
            className="select"
            value={role}
            onChange={(e) => setRole(e.target.value as RoleCode | "")}
          >
            <option value="">Mọi role</option>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Lọc theo trạng thái</span>
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as AccountStatus | "")}
          >
            <option value="">Mọi trạng thái</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <Card flush>
        {rows.length === 0 ? (
          <Empty
            title="Không tìm thấy người dùng"
            desc="Thử đổi từ khóa hoặc bộ lọc."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Role</th>
                  <th>Trạng thái</th>
                  <th className="num">Uy tín</th>
                  <th className="num">Credit</th>
                  <th>Tham gia</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-user">
                        <Avatar name={u.name} />
                        <div>
                          <Link className="link" href={`/admin/users/${u.id}`}>
                            {u.name}
                          </Link>
                          <span>{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="chips">
                        {u.roles
                          .filter((r) => r !== "USER" || u.roles.length === 1)
                          .map((r) => (
                            <StatusBadge key={r} status={r} />
                          ))}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="num">{u.reputation}</td>
                    <td className="num">{fmtNum(u.credit)}</td>
                    <td className="muted">{fmtDate(u.joinedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-foot">
          Hiển thị {rows.length}/{users.length} người dùng
        </div>
      </Card>
    </>
  );
}
