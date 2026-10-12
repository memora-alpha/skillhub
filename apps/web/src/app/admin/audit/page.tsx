"use client";

import { useState } from "react";
import { useConsole } from "@/components/console/context";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  SearchBox,
} from "@/components/console/ui";
import type { RoleCode } from "@/lib/console/data";
import { fmtDateTime } from "@/lib/console/format";

export default function AdminAuditPage() {
  const { audit } = useConsole();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [role, setRole] = useState<RoleCode | "">("");

  const actions = [...new Set(audit.map((a) => a.action))].sort((a, b) =>
    a.localeCompare(b),
  );
  const q = query.trim().toLowerCase();
  const rows = audit.filter(
    (a) =>
      (!q ||
        `${a.actor} ${a.target} ${a.reason ?? ""}`.toLowerCase().includes(q)) &&
      (!action || a.action === action) &&
      (!role || a.role === role),
  );

  return (
    <>
      <PageHeader
        title="Audit log"
        desc="Nhật ký bất biến của mọi thao tác nhạy cảm: khóa tài khoản, điều chỉnh Credit, kiểm duyệt, giải quyết tranh chấp."
      />
      <div className="toolbar">
        <SearchBox
          label="Tìm trong Audit log"
          placeholder="Người thực hiện, đối tượng, lý do…"
          value={query}
          onChange={setQuery}
        />
        <label>
          <span className="sr-only">Lọc theo hành động</span>
          <select
            className="select"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="">Mọi hành động</option>
            {actions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Lọc theo vai trò</span>
          <select
            className="select"
            value={role}
            onChange={(e) => setRole(e.target.value as RoleCode | "")}
          >
            <option value="">Mọi vai trò</option>
            <option>ADMIN</option>
            <option>STAFF</option>
          </select>
        </label>
      </div>
      <Card flush>
        {rows.length === 0 ? (
          <Empty title="Không có bản ghi phù hợp" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                  <th>Thay đổi</th>
                  <th>Lý do</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="muted">{fmtDateTime(a.at)}</td>
                    <td>
                      {a.actor}{" "}
                      <Badge tone={a.role === "ADMIN" ? "brand" : "info"}>
                        {a.role}
                      </Badge>
                    </td>
                    <td className="mono">{a.action}</td>
                    <td className="mono">{a.target}</td>
                    <td className="cell-wrap">
                      {a.before || a.after ? (
                        <>
                          <span className="muted">{a.before ?? "—"}</span> →{" "}
                          <strong>{a.after ?? "—"}</strong>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="cell-wrap">{a.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-foot">
          Hiển thị {rows.length}/{audit.length} bản ghi
        </div>
      </Card>
    </>
  );
}
