import { Copy, RouteButton } from "@/components/feature-page";
import { FlowSection } from "@/components/learning-flow";
import type { ParticipantCase } from "../api/path-overview-contract";
import { pathDate, pathReasonLabel } from "../utils/path-overview-presentation";

const statuses: Record<string, string> = {
  OPEN: "Đã tiếp nhận",
  UNDER_REVIEW: "Đang xem xét",
  NEED_MORE_INFO: "Cần bổ sung thông tin",
  RESOLVED: "Đã giải quyết",
  REJECTED: "Bị từ chối",
};
export function ParticipantCaseCard({
  item,
  detail = false,
}: Readonly<{ item: ParticipantCase; detail?: boolean }>) {
  const open = ["OPEN", "UNDER_REVIEW", "NEED_MORE_INFO"].includes(item.status);
  return (
    <FlowSection title={pathReasonLabel(item.reasonCode)}>
      <Copy>{statuses[item.status] ?? "Trạng thái đang được cập nhật"}</Copy>
      <Copy muted size="hint">
        Mã vụ việc: {item.id}
      </Copy>
      {item.createdAt && (
        <Copy muted size="hint">
          Ghi nhận: {pathDate(item.createdAt)}
        </Copy>
      )}
      {item.resolvedAt && (
        <Copy muted size="hint">
          Giải quyết: {pathDate(item.resolvedAt)}
        </Copy>
      )}
      {item.blocksSettlement && open && (
        <Copy>Vụ việc đang chặn quyết toán Credit.</Copy>
      )}
      {!detail && (
        <RouteButton
          secondary
          href={`/paths/${item.relatedPathId}/cases/${item.id}`}
        >
          Xem tóm tắt vụ việc
        </RouteButton>
      )}
      {detail && item.relatedSessionId && (
        <RouteButton
          secondary
          href={`/learning-sessions/${item.relatedSessionId}`}
        >
          Xem buổi học của vụ việc
        </RouteButton>
      )}
      {detail && (
        <RouteButton secondary href={`/paths/${item.relatedPathId}/sessions`}>
          Xem tất cả buổi học
        </RouteButton>
      )}
    </FlowSection>
  );
}
