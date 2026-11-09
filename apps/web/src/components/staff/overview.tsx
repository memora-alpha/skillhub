"use client";
import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/console/ui";
import { Icon } from "@/components/console/icon";
import { reportReasonLabel } from "@/lib/staff/report-presentation";
import type { SupportCase } from "./report-support-types";
import { fmtDateTime } from "@/lib/console/format";
import { prepareOverviewQueue } from "@/lib/staff/overview-queue";
import type {
  LearningRequest,
  Verification,
  Pagination,
} from "@/lib/staff/types";
import { useStaffList } from "./hooks";
import { useStaffSession } from "./session";
import type { ModeratedMaterial } from "@/lib/staff/account-types";
import type { TagRequest } from "@/lib/staff/admin-types";
import type { IconName } from "@/components/console/icon";
type QueueSummary = Readonly<{
  loading: boolean;
  error?: string;
  items: readonly unknown[];
  page?: Pagination;
  reload: () => void;
}>;
function queueCount(source: QueueSummary): string {
  if (source.loading) return "…";
  if (source.error) return "—";
  return `${source.items.length}${source.page?.hasMore ? "+" : ""}`;
}
function emptyQueueMessage(
  groups: readonly { source: QueueSummary }[],
): string {
  if (groups.some((group) => group.source.loading)) return "Đang tải hàng đợi…";
  if (groups.some((group) => group.source.error))
    return "Một số hàng đợi chưa tải được. Mở từng hàng đợi để kiểm tra.";
  return "Hiện không có mục nào cần xử lý.";
}
export function OverviewScreen({
  tagRequests,
}: Readonly<{
  tagRequests?: Omit<QueueSummary, "items"> & { items: readonly TagRequest[] };
}>) {
  const { actor, portal } = useStaffSession();
  const evidence = useStaffList<Verification>(
    "verifications?status=PENDING&limit=20",
  );
  const requests = useStaffList<LearningRequest>("learning-requests?limit=20");
  const reports = useStaffList<SupportCase>("reports/support/queue?limit=20");
  const materials = useStaffList<ModeratedMaterial>(
    "materials?status=PENDING_REVIEW",
  );
  const groups: {
    title: string;
    icon: IconName;
    href: string;
    source: QueueSummary;
  }[] = [
    {
      title: "Bằng chứng kỹ năng",
      icon: "shield" as const,
      href: `/${portal}/evidence`,
      source: evidence,
    },
    {
      title: "Yêu cầu học",
      icon: "flag" as const,
      href: `/${portal}/moderation`,
      source: requests,
    },
    {
      title: "Báo cáo đang mở",
      icon: "alert" as const,
      href: `/${portal}/disputes`,
      source: reports,
    },
    {
      title: "Tài liệu",
      icon: "file",
      href: `/${portal}/content`,
      source: materials,
    },
    ...(tagRequests
      ? [
          {
            title: "Đề xuất tag",
            icon: "tag" as const,
            href: "/admin/tag-requests",
            source: tagRequests,
          },
        ]
      : []),
  ];
  const rows = prepareOverviewQueue([
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
      title: reportReasonLabel(r.reasonCode),
      kind: "Báo cáo",
      at: r.createdAt,
      href: `/${portal}/disputes/${r.id}`,
    })),
    ...materials.items.map((r) => ({
      id: r.id,
      title: r.title,
      kind: "Tài liệu",
      at: r.createdAt,
      href: `/${portal}/content`,
    })),
    ...(tagRequests?.items ?? []).map((r) => ({
      id: r.id,
      title: r.label,
      kind: "Đề xuất tag",
      at: r.createdAt,
      href: "/admin/tag-requests",
    })),
  ]);
  return (
    <section className="ops-overview">
      <PageHeader
        title={`Chào ${actor?.fullName ?? "bạn"}`}
        desc="Bắt đầu từ các mục cần xem xét trong hàng đợi của bạn."
        actions={
          <button
            type="button"
            className="btn"
            disabled={groups.some((g) => g.source.loading)}
            onClick={() => {
              for (const group of groups) group.source.reload();
            }}
          >
            <Icon name="refresh" size={16} /> Làm mới tất cả
          </button>
        }
      />
      <div className="ops-section-heading">
        <div>
          <h2>Cần xử lý</h2>
          <p className="muted">
            Số lượng phản ánh các mục đã tải trong từng hàng đợi.
          </p>
        </div>
      </div>
      <div className="grid staff-queue-cards">
        {groups.map((group) => (
          <Card key={group.href} className="ops-queue-card">
            <Link className="ops-queue-link" href={group.href}>
              <span className="ops-queue-icon">
                <Icon name={group.icon} size={22} />
              </span>
              <span className="ops-queue-summary">
                <span>{group.title}</span>
                <strong>{queueCount(group.source)}</strong>
                <small className="muted">
                  {group.source.error
                    ? "Chưa tải được"
                    : group.source.page?.hasMore
                      ? "mục đã tải · còn trang sau"
                      : "mục đang hiển thị"}
                </small>
              </span>
              <Icon name="right" size={16} />
            </Link>
            {group.source.error && (
              <p className="staff-error" role="alert">
                {group.source.error}
              </p>
            )}
            {group.source.error && (
              <button
                className="btn btn-sm"
                disabled={group.source.loading}
                onClick={group.source.reload}
              >
                Thử tải lại
              </button>
            )}
          </Card>
        ))}
      </div>
      <Card
        className="section ops-queue-table"
        title="Các mục đang chờ xem xét"
        actions={
          <span className="muted">
            Tối đa 8 mục cũ nhất trong dữ liệu đã tải
          </span>
        }
        flush
      >
        {!rows.length ? (
          <p className="staff-state">{emptyQueueMessage(groups)}</p>
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
                    <td>
                      {row.at ? fmtDateTime(row.at) : "Chưa có thời gian"}
                    </td>
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
    </section>
  );
}
