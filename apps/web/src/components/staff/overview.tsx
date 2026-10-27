"use client";
import Link from "next/link";
import { Badge, Card, PageHeader, Stat } from "@/components/console/ui";
import { fmtDateTime } from "@/lib/console/format";
import type {
  LearningRequest,
  ReportCase,
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
function queueCount(source: QueueSummary, cap?: number): string {
  if (source.loading) return "…";
  if (source.error) return "—";
  return `${source.items.length}${source.page?.hasMore || (cap && source.items.length >= cap) ? "+" : ""}`;
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
  const reports = useStaffList<ReportCase>("reports");
  const materials = useStaffList<ModeratedMaterial>(
    "materials?status=PENDING_REVIEW",
  );
  const groups: {
    title: string;
    icon: IconName;
    href: string;
    source: QueueSummary;
    cap?: number;
  }[] = [
    {
      title: "Xác minh kỹ năng",
      icon: "shield" as const,
      href: `/${portal}/evidence`,
      source: evidence,
    },
    {
      title: "Kiểm duyệt yêu cầu học",
      icon: "flag" as const,
      href: `/${portal}/moderation`,
      source: requests,
    },
    {
      title: "Báo cáo & tranh chấp",
      icon: "alert" as const,
      href: `/${portal}/disputes`,
      source: reports,
      cap: 100,
    },
    {
      title: "Tài liệu chờ duyệt",
      icon: "file",
      href: `/${portal}/content`,
      source: materials,
      cap: 100,
    },
    ...(tagRequests
      ? [
          {
            title: "Đề xuất tag chờ duyệt",
            icon: "tag" as const,
            href: "/admin/tag-requests",
            source: tagRequests,
          },
        ]
      : []),
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
            type="button"
            className="btn"
            disabled={groups.some((g) => g.source.loading)}
            onClick={() => {
              for (const group of groups) group.source.reload();
            }}
          >
            Làm mới hàng đợi
          </button>
        }
      />
      <div className="grid staff-queue-cards">
        {groups.map((group) => (
          <Card key={group.href}>
            <Stat
              label={group.title}
              icon={group.icon}
              value={queueCount(group.source, group.cap)}
              hint={
                group.cap
                  ? `Đã tải tối đa ${group.cap} mục`
                  : "Số mục đã tải trong hàng đợi"
              }
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
