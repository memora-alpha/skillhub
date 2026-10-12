"use client";

import Link from "next/link";
import { useConsole } from "@/components/console/context";
import { Badge, Card, PageHeader, Stat } from "@/components/console/ui";
import {
  EVIDENCE,
  FLAGGED,
  KPI,
  MATERIALS,
  SESSIONS_PER_DAY,
} from "@/lib/console/data";
import { fmtDateTime, fmtNum } from "@/lib/console/format";

const MAX = Math.max(...SESSIONS_PER_DAY.map((d) => d.value));

export default function AdminDashboardPage() {
  const { audit, disputes } = useConsole();
  const queues = [
    {
      label: "Bằng chứng kỹ năng",
      n: EVIDENCE.filter((e) => e.status === "PENDING").length,
      href: "/admin/evidence",
    },
    {
      label: "Request bị gắn cờ",
      n: FLAGGED.filter((r) => r.status === "PENDING_MODERATION").length,
      href: "/admin/moderation",
    },
    {
      label: "Tài liệu chờ duyệt",
      n: MATERIALS.filter((m) => m.status === "PENDING_REVIEW").length,
      href: "/admin/moderation",
    },
    {
      label: "Tranh chấp đang mở",
      n: disputes.filter(
        (d) => d.status === "OPEN" || d.status === "UNDER_REVIEW",
      ).length,
      href: "/admin/disputes",
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        desc="Tổng quan vận hành và KPI 7 ngày gần nhất."
      />
      <div className="grid grid-4">
        <Stat
          label="Người dùng"
          value={fmtNum(KPI.users.total)}
          icon="users"
          delta={KPI.users.delta}
          hint="so với tuần trước"
        />
        <Stat
          label="Phiên học tuần này"
          value={fmtNum(KPI.sessionsWeek.total)}
          icon="video"
          delta={KPI.sessionsWeek.delta}
          hint="COMPLETED"
        />
        <Stat
          label="Credit giao dịch"
          value={fmtNum(KPI.creditVolume.total)}
          icon="card"
          delta={KPI.creditVolume.delta}
          hint="7 ngày"
        />
        <Stat
          label="Phí nền tảng (4%)"
          value={fmtNum(KPI.platformFee.total)}
          icon="award"
          delta={KPI.platformFee.delta}
          hint="Credit"
        />
      </div>

      <div className="grid grid-main section">
        <Card title="Phiên học hoàn thành theo ngày">
          <ul
            className="bars"
            aria-label="Số phiên học hoàn thành mỗi ngày trong tuần"
          >
            {SESSIONS_PER_DAY.map((d) => (
              <li key={d.day}>
                <div
                  className="bar"
                  style={{ height: `${(d.value / MAX) * 100}%` }}
                />
                <strong>{d.value}</strong>
                <span>{d.day}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Hàng đợi cần xử lý" flush>
          <ul className="plain-list">
            {queues.map((q) => (
              <li key={q.label}>
                <Link className="plain-row" href={q.href}>
                  <span>{q.label}</span>
                  <Badge tone={q.n > 0 ? "warn" : "ok"}>{q.n}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        title="Hoạt động Audit gần đây"
        className="section"
        actions={
          <Link className="link" href="/admin/audit">
            Xem tất cả
          </Link>
        }
        flush
      >
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện</th>
                <th>Hành động</th>
                <th>Đối tượng</th>
              </tr>
            </thead>
            <tbody>
              {audit.slice(0, 5).map((a) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
