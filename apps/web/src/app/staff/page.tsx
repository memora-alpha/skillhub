import Link from "next/link";
import { Badge, Card, PageHeader, Stat } from "@/components/console/ui";
import {
  DISPUTES,
  EVIDENCE,
  FLAGGED,
  MATERIALS,
  userName,
} from "@/lib/console/data";
import { fmtDateTime } from "@/lib/console/format";

const evidence = EVIDENCE.filter((e) => e.status === "PENDING");
const requests = FLAGGED.filter((r) => r.status === "PENDING_MODERATION");
const materials = MATERIALS.filter((m) => m.status === "PENDING_REVIEW");
const disputes = DISPUTES.filter(
  (d) => d.status === "OPEN" || d.status === "UNDER_REVIEW",
);

// Oldest first across every queue, so nothing starves behind a busier queue.
const OLDEST = [
  ...evidence.map((e) => ({
    id: e.id,
    kind: "Bằng chứng",
    title: `${e.skill} — ${userName(e.userId)}`,
    at: e.submittedAt,
    href: "/staff/evidence",
  })),
  ...requests.map((r) => ({
    id: r.id,
    kind: "Learning Request",
    title: r.title,
    at: r.submittedAt,
    href: "/staff/moderation",
  })),
  ...materials.map((m) => ({
    id: m.id,
    kind: "Tài liệu",
    title: m.title,
    at: m.submittedAt,
    href: "/staff/moderation",
  })),
  ...disputes.map((d) => ({
    id: d.id,
    kind: "Tranh chấp",
    title: d.reason,
    at: d.createdAt,
    href: `/staff/disputes/${d.id}`,
  })),
].sort((a, b) => a.at.localeCompare(b.at));

export default function StaffOverviewPage() {
  return (
    <>
      <PageHeader
        title="Tổng quan hàng đợi"
        desc="Các mục đang chờ bạn xử lý. Mọi quyết định nhạy cảm đều được ghi Audit log."
      />
      <div className="grid grid-4">
        <Stat
          label="Bằng chứng chờ duyệt"
          value={String(evidence.length)}
          icon="shield"
          hint="Skill Evidence"
        />
        <Stat
          label="Request bị gắn cờ"
          value={String(requests.length)}
          icon="flag"
          hint="PENDING_MODERATION"
        />
        <Stat
          label="Tài liệu chờ duyệt"
          value={String(materials.length)}
          icon="file"
          hint="PENDING_REVIEW"
        />
        <Stat
          label="Tranh chấp đang mở"
          value={String(disputes.length)}
          icon="alert"
          hint="Report / Dispute"
        />
      </div>
      <Card title="Chờ lâu nhất" className="section" flush>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Loại</th>
                <th>Nội dung</th>
                <th>Gửi lúc</th>
                <th>
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {OLDEST.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Badge tone="brand">{row.kind}</Badge>
                  </td>
                  <td>{row.title}</td>
                  <td className="muted">{fmtDateTime(row.at)}</td>
                  <td>
                    <Link className="link" href={row.href}>
                      Xử lý
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
