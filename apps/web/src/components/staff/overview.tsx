"use client";
import { LoadingButton } from "@/components/loading-button";
import Link from "next/link";
import type { ReactNode } from "react";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge, Card, Empty, PageHeader } from "@/components/console/ui";
import { Icon, type IconName } from "@/components/console/icon";
import { reportReasonLabel } from "@/lib/staff/report-presentation";
import type { SupportCase } from "./report-support-types";
import { fmtDateTime } from "@/lib/console/format";
import { prepareOverviewQueue } from "@/lib/staff/overview-queue";
import {
  countGrantedDelegablePermissions,
  hasAnyPermission,
  hasPermission,
  STAFF_DELEGABLE_PERMISSIONS,
} from "@/lib/staff/permissions";
import type {
  LearningRequest,
  Verification,
  Pagination,
} from "@/lib/staff/types";
import type { ModeratedMaterial } from "@/lib/staff/account-types";
import type { TerminationChange } from "@/lib/staff/termination";
import { useStaffList, useStaffResource } from "./hooks";
import { useStaffSession } from "./session";

type QueueSummary = Readonly<{
  loading: boolean;
  error?: string;
  items: readonly unknown[];
  page?: Pagination;
  reload: () => void;
}>;

function queueCount(source: QueueSummary): ReactNode {
  if (source.loading) return <LoadingSkeleton variant="inline" />;
  if (source.error) return "—";
  return `${source.items.length}${source.page?.hasMore ? "+" : ""}`;
}

function emptyQueueMessage(
  groups: readonly { source: QueueSummary }[],
): ReactNode {
  if (!groups.length)
    return "Tài khoản của bạn hiện chưa được cấp hàng đợi kiểm duyệt nào. Liên hệ quản trị viên nếu cần mở quyền.";
  if (groups.some((group) => group.source.loading))
    return <LoadingSkeleton variant="table" label="Đang tải hàng đợi" />;
  if (groups.some((group) => group.source.error))
    return "Một số hàng đợi chưa tải được. Mở từng hàng đợi để kiểm tra.";
  return "Tuyệt vời — hiện không có mục nào đang chờ xử lý trong phạm vi quyền của bạn.";
}

export function OverviewScreen() {
  const { actor, portal } = useStaffSession();
  const canEvidence = hasPermission(actor, "skill-verification:read");
  const canRequests = hasPermission(actor, "learning-request:moderation:read");
  const canReports = hasPermission(actor, "report:moderate");
  const canMaterials = hasPermission(actor, "material:moderate");
  const canContentReview = hasAnyPermission(actor, [
    "profile:moderate",
    "review:moderate",
    "material-review:moderate",
  ]);
  const canExecuteTermination =
    canReports && hasPermission(actor, "learning-path:terminate");

  const evidence = useStaffList<Verification>(
    "verifications?status=PENDING&limit=20",
    { enabled: canEvidence },
  );
  const requests = useStaffList<LearningRequest>("learning-requests?limit=20", {
    enabled: canRequests,
  });
  const reports = useStaffList<SupportCase>("reports/support/queue?limit=20", {
    enabled: canReports,
  });
  const materials = useStaffList<ModeratedMaterial>(
    "materials?status=PENDING_REVIEW&limit=20",
    { enabled: canMaterials },
  );
  const terminationsResource = useStaffResource<{
    items: TerminationChange[];
    nextCursor: string | null;
  }>("learning-changes/review-queue?limit=20", { enabled: canReports });

  const terminationItems = terminationsResource.data?.items ?? [];
  const terminationsSummary: QueueSummary = {
    loading: terminationsResource.loading,
    error: terminationsResource.error,
    items: terminationItems,
    page: terminationsResource.data
      ? {
          hasMore: !!terminationsResource.data.nextCursor,
          nextCursor: terminationsResource.data.nextCursor,
          limit: 20,
        }
      : undefined,
    reload: () => {
      void terminationsResource.reload();
    },
  };

  const groups: {
    id: string;
    title: string;
    subtitle: string;
    icon: IconName;
    href: string;
    source: QueueSummary;
  }[] = [
    ...(canEvidence
      ? [
          {
            id: "evidence",
            title: "Bằng chứng kỹ năng",
            subtitle: "Chờ xác minh chứng chỉ",
            icon: "shield" as const,
            href: `/${portal}/evidence`,
            source: evidence,
          },
        ]
      : []),
    ...(canRequests
      ? [
          {
            id: "requests",
            title: "Yêu cầu học gắn cờ",
            subtitle: "Chờ kiểm duyệt nội dung",
            icon: "flag" as const,
            href: `/${portal}/moderation`,
            source: requests,
          },
        ]
      : []),
    ...(canMaterials
      ? [
          {
            id: "materials",
            title: "Tài liệu số",
            subtitle: "Chờ duyệt trước khi công bố",
            icon: "file" as const,
            href: `/${portal}/content`,
            source: materials,
          },
        ]
      : []),
    ...(canReports
      ? [
          {
            id: "reports",
            title: "Báo cáo & tranh chấp",
            subtitle: "Đang mở / cần xử lý",
            icon: "alert" as const,
            href: `/${portal}/disputes`,
            source: reports,
          },
          {
            id: "terminations",
            title: "Yêu cầu dừng lộ trình",
            subtitle: canExecuteTermination
              ? "Có quyền xem xét & duyệt dừng"
              : "Xem xét & từ chối yêu cầu",
            icon: "clock" as const,
            href: `/${portal}/learning-changes`,
            source: terminationsSummary,
          },
        ]
      : []),
  ];

  const rows = prepareOverviewQueue([
    ...(canEvidence
      ? evidence.items.map((r) => ({
          id: r.id,
          title: `Yêu cầu xác minh #${r.id.slice(0, 8)} (${r.files.length} tệp)`,
          kind: "Bằng chứng",
          at: r.submittedAt,
          href: `/${portal}/evidence?verificationId=${r.id}`,
        }))
      : []),
    ...(canRequests
      ? requests.items.map((r) => ({
          id: r.id,
          title: r.title,
          kind: "Yêu cầu học",
          at: r.createdAt,
          href: `/${portal}/moderation`,
        }))
      : []),
    ...(canMaterials
      ? materials.items.map((r) => ({
          id: r.id,
          title: r.title,
          kind: "Tài liệu số",
          at: r.createdAt,
          href: `/${portal}/content`,
        }))
      : []),
    ...(canReports
      ? reports.items.map((r) => ({
          id: r.id,
          title: reportReasonLabel(r.reasonCode),
          kind: "Báo cáo",
          at: r.createdAt,
          href: `/${portal}/disputes/${r.id}`,
        }))
      : []),
    ...(canReports
      ? terminationItems.map((r) => ({
          id: r.id,
          title: r.reason || `Yêu cầu dừng lộ trình #${r.id.slice(0, 8)}`,
          kind: "Dừng lộ trình",
          at: r.createdAt,
          href: `/${portal}/learning-changes?requestId=${r.id}&pathId=${r.pathId}`,
        }))
      : []),
  ]);

  const anyLoading = groups.some((g) => g.source.loading);
  const grantedCount = countGrantedDelegablePermissions(actor);

  const scopeCapabilities = [
    {
      label: "Xác minh bằng chứng kỹ năng",
      detail: hasPermission(actor, "skill-verification:approve")
        ? "Xem, duyệt và từ chối bằng chứng"
        : canEvidence
          ? "Chỉ xem hàng đợi bằng chứng"
          : "Chưa được cấp quyền",
      allowed: canEvidence,
      href: `/${portal}/evidence`,
    },
    {
      label: "Kiểm duyệt yêu cầu học",
      detail: hasPermission(actor, "learning-request:approve")
        ? "Duyệt hoặc từ chối bài bị bộ lọc gắn cờ"
        : canRequests
          ? "Chỉ xem bài chờ kiểm duyệt"
          : "Chưa được cấp quyền",
      allowed: canRequests,
      href: `/${portal}/moderation`,
    },
    {
      label: "Kiểm duyệt tài liệu số",
      detail: canMaterials
        ? "Duyệt, từ chối, ẩn/hiện tài liệu FREE & PAID"
        : "Chưa được cấp quyền",
      allowed: canMaterials,
      href: `/${portal}/content`,
    },
    {
      label: "Hồ sơ & đánh giá",
      detail: canContentReview
        ? "Kiểm duyệt đánh giá lộ trình, tài liệu hoặc hồ sơ"
        : "Quyền mở rộng — liên hệ Admin khi cần",
      allowed: canContentReview,
      href: `/${portal}/profile-moderation`,
    },
    {
      label: "Báo cáo, tranh chấp & dừng lộ trình",
      detail: canReports
        ? canExecuteTermination
          ? "Xử lý vụ việc & duyệt dừng lộ trình theo phương án Credit"
          : "Xử lý báo cáo & xem xét yêu cầu dừng lộ trình"
        : "Chưa được cấp quyền",
      allowed: canReports,
      href: `/${portal}/disputes`,
    },
  ];

  return (
    <section className="ops-overview">
      <PageHeader
        title={`Xin chào, ${actor?.fullName ?? "nhân viên"}`}
        desc="Ưu tiên xử lý các hồ sơ chờ lâu nhất theo đúng phạm vi quyền vận hành được cấp."
        actions={
          <div className="row">
            <Badge tone="brand">
              {grantedCount}/{STAFF_DELEGABLE_PERMISSIONS.length} quyền vận hành
            </Badge>
            <LoadingButton
              type="button"
              className="btn btn-primary"
              disabled={anyLoading || !groups.length}
              onClick={() => {
                for (const group of groups) group.source.reload();
              }}
              loading={anyLoading}
            >
              <Icon name="refresh" size={16} /> Làm mới tất cả
            </LoadingButton>
          </div>
        }
      />

      {groups.length > 0 && (
        <div className="ops-kpi-grid" aria-label="Tổng hợp hàng đợi cần xử lý">
          {groups.map((group) => {
            const count = group.source.items.length;
            const urgent =
              !group.source.loading && !group.source.error && count > 0;
            return (
              <div key={group.id} className="stack">
                <Link
                  className="ops-kpi-card"
                  href={group.href}
                  data-urgent={urgent ? "true" : undefined}
                >
                  <div className="ops-kpi-top">
                    <span className="ops-kpi-icon">
                      <Icon name={group.icon} size={18} />
                    </span>
                    <Icon name="right" size={15} />
                  </div>
                  <div className="ops-kpi-value">
                    {queueCount(group.source)}
                  </div>
                  <div>
                    <div className="ops-kpi-label">{group.title}</div>
                    <div className="ops-kpi-hint">
                      {group.source.error
                        ? "Chưa tải được"
                        : group.source.page?.hasMore
                          ? `${group.subtitle} · còn trang sau`
                          : group.subtitle}
                    </div>
                  </div>
                </Link>
                {group.source.error && (
                  <p className="staff-error" role="alert">
                    {group.source.error}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Card
        title="Hàng đợi ưu tiên (cũ nhất trước)"
        actions={
          <span className="muted">
            Tối đa 8 mục gửi sớm nhất từ các hàng đợi được phân quyền
          </span>
        }
        flush
      >
        {!rows.length ? (
          <div className="staff-state">{emptyQueueMessage(groups)}</div>
        ) : (
          <div className="table-wrap">
            <table className="table admin-responsive-table">
              <thead>
                <tr>
                  <th>Phân hệ</th>
                  <th>Nội dung cần xử lý</th>
                  <th>Gửi lúc</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.kind}:${row.id}`}>
                    <td data-label="Phân hệ">
                      <Badge tone="brand">{row.kind}</Badge>
                    </td>
                    <td data-label="Nội dung cần xử lý">
                      <strong>{row.title}</strong>
                    </td>
                    <td data-label="Gửi lúc">
                      {row.at ? fmtDateTime(row.at) : "Chưa có thời gian"}
                    </td>
                    <td data-label="Thao tác">
                      <Link className="btn btn-sm" href={row.href}>
                        Mở xử lý →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Phạm vi quyền vận hành của bạn"
        actions={
          actor?.roles.includes("STAFF") ? (
            <Link className="link" href="/learn">
              Chuyển sang Không gian học (Ví &amp; Uy tín cá nhân) →
            </Link>
          ) : undefined
        }
      >
        <div className="ops-scope-grid">
          {scopeCapabilities.map((cap) => (
            <div className="ops-scope-item" key={cap.label}>
              <div>
                <strong>{cap.label}</strong>
                <small>{cap.detail}</small>
              </div>
              {cap.allowed ? (
                <Link href={cap.href} className="badge badge-ok">
                  Được phép
                </Link>
              ) : (
                <Badge tone="neutral">Chưa mở</Badge>
              )}
            </div>
          ))}
        </div>
        {!groups.length && (
          <Empty
            title="Chưa có phân hệ kiểm duyệt khả dụng"
            desc="Quản trị viên có thể bật từng quyền chi tiết tại mục Nhân viên & phân quyền."
          />
        )}
      </Card>
    </section>
  );
}
