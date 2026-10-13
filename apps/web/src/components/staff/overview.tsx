"use client";
import Link from "next/link";
import { Badge, Card, PageHeader, Stat } from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import type {
  LearningRequest,
  ReportCase,
  Verification,
} from "@/lib/staff/types";
import { useStaffList } from "./hooks";
import { useStaffSession } from "./session";
export function OverviewScreen() {
  const { actor, portal } = useStaffSession();
  const evidence = useStaffList<Verification>(
    "verifications?status=PENDING&limit=20",
  );
  const requests = useStaffList<LearningRequest>("learning-requests?limit=20");
  const reports = useStaffList<ReportCase>("reports");
  const groups = [
    {
      title: "Xác minh kỹ năng",
      icon: "shield" as const,
      href: `/${portal}/evidence`,
      source: evidence,
    },
    {
      title: "Yêu cầu học chờ duyệt",
      icon: "flag" as const,
      href: `/${portal}/moderation`,
      source: requests,
    },
    {
      title: "Báo cáo & tranh chấp",
      icon: "alert" as const,
      href: `/${portal}/disputes`,
      source: reports,
    },
  ];
  const rows = [
    ...evidence.items.map((r) => ({
      id: r.id,
      title: `Xác minh #${r.id.slice(0, 8)}`,
      kind: "Bằng chứng",
      at: r.submittedAt,
      href: `/${portal}/evidence`,
    })),
    ...requests.items.map((r) => ({
      id: r.id,
      title: r.title,
      kind: "Yêu cầu học",
      at: r.createdAt,
      href: `/${portal}/moderation`,
    })),
    ...reports.items.map((r) => ({
      id: r.id,
      title: r.reasonCode,
      kind: "Báo cáo",
      at: r.createdAt,
      href: `/${portal}/disputes/${r.id}`,
    })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 8);
  return (
    <>
      <PageHeader
        title={`Chào ${actor?.fullName ?? "bạn"}`}
        desc="Bắt đầu từ các mục cần xem xét trong hàng đợi của bạn."
        actions={
          <button
            className="btn"
            disabled={groups.some((g) => g.source.loading)}
            onClick={() => {
              for (const group of groups) void group.source.reload();
            }}
          >
            Làm mới hàng đợi
          </button>
        }
      />
      <div className="staff-overview-intro">
        <div>
          <span className="staff-eyebrow">CÙNG GIỮ CỘNG ĐỒNG ĐÁNG TIN CẬY</span>
          <h2>Mỗi quyết định đều có ý nghĩa.</h2>
          <p>Kiểm tra bằng chứng, đọc kỹ nội dung và ghi rõ lý do xử lý.</p>
        </div>
        <Badge tone="brand">
          {portal === "admin" ? "Không gian Admin" : "Không gian Staff"}
        </Badge>
      </div>
      <div className="grid staff-queue-cards">
        {groups.map((group) => (
          <Card key={group.href}>
            <Stat
              label={group.title}
              icon={group.icon}
              value={
                group.source.loading
                  ? "…"
                  : group.source.error
                    ? "—"
                    : `${group.source.items.length}${group.source.page?.hasMore ? "+" : ""}`
              }
              hint="Số mục đang được tải trong hàng đợi"
            />
            {group.source.error && (
              <p className="staff-error" role="alert">
                {group.source.error}
              </p>
            )}
            <Link className="link" href={group.href}>
              Mở hàng đợi →
            </Link>
          </Card>
        ))}
      </div>
      <Card className="section" title="Các mục đang chờ xem xét" flush>
        {!rows.length ? (
          <p className="staff-state">
            {groups.some((g) => g.source.loading)
              ? "Đang tải hàng đợi…"
              : groups.some((g) => g.source.error)
                ? "Một số hàng đợi chưa tải được. Mở từng hàng đợi để kiểm tra."
                : "Hiện không có mục nào cần xử lý."}
          </p>
        ) : (
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
                {rows.map((row) => (
                  <tr key={`${row.kind}:${row.id}`}>
                    <td>
                      <Badge tone="brand">{row.kind}</Badge>
                    </td>
                    <td>{row.title}</td>
                    <td>{fmtDateTime(row.at)}</td>
                    <td>
                      <Link className="link" href={row.href}>
                        Xem xét →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
