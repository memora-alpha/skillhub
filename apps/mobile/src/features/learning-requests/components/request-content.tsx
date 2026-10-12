import { View } from "react-native";
import { Badge } from "@/components/Badge";
import { Copy } from "@/components/feature-page";
import { RequestSection as Panel } from "./request-section";
import { FormNotice } from "@/components/FormNotice";
import { uiLabel } from "@/constants/ui-copy";
import { useSkillName } from "../hooks/use-requests";
import {
  isOwnRequest,
  requestState,
  statusLabels,
  dateLabel,
} from "../utils/request-policy";
import type { OwnerRequest, PublicRequestDetail } from "../types";
export function RequestContent({
  request,
}: {
  request: OwnerRequest | PublicRequestDetail;
}) {
  const own = isOwnRequest(request);
  const skill = useSkillName(own ? request.skillId : undefined);
  const state = requestState(request);
  return (
    <>
      <Panel title={request.title}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Badge
            label={statusLabels[state]}
            variant={
              state === "OPEN"
                ? "success"
                : state === "PENDING_MODERATION"
                  ? "warning"
                  : "default"
            }
          />
          {own && (
            <Badge label={`Kiểm duyệt: ${uiLabel(request.moderationStatus)}`} />
          )}
        </View>
        <Copy>
          {own
            ? (skill.data?.name ?? "Thông tin kỹ năng chưa khả dụng")
            : request.skill.name}{" "}
          ·{" "}
          {request.currentLevel
            ? uiLabel(request.currentLevel)
            : "Chưa khai trình độ"}
        </Copy>
        {!own && <Copy muted>Người đăng: {request.owner.displayName}</Copy>}
        {request.verifiedTeacherOnly && (
          <Copy>Chỉ nhận người dạy có kỹ năng này đã được xác minh.</Copy>
        )}
        <Copy muted>Ngày tạo: {dateLabel(request.createdAt)}</Copy>
        {request.expiresAt && (
          <Copy muted>Hạn yêu cầu: {dateLabel(request.expiresAt)}</Copy>
        )}
      </Panel>
      <Panel title="Nhu cầu học">
        <Copy>{request.description}</Copy>
      </Panel>
      <Panel title="Mục tiêu học tập">
        <Copy>{request.learningGoal}</Copy>
      </Panel>
      {!own && request.tags.length > 0 && (
        <Panel title="Tag">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {request.tags.map((tag) => (
              <Badge key={tag.id} label={tag.label} />
            ))}
          </View>
        </Panel>
      )}
      {own && request.tagIds.length > 0 && (
        <Copy muted>
          {request.tagIds.length} tag đã chọn được giữ nguyên. Tên tag hiện chưa
          khả dụng.
        </Copy>
      )}
      {request.preferredSlots.length > 0 && (
        <Panel title="Thời gian ưu tiên">
          <Copy muted>Theo múi giờ thiết bị · Chưa chốt lịch học</Copy>
          {request.preferredSlots.map((slot, index) => (
            <Copy key={`${slot.startAt}-${index}`}>
              {dateLabel(slot.startAt)} → {dateLabel(slot.endAt)}
            </Copy>
          ))}
        </Panel>
      )}
      {own &&
        request.moderationStatus === "REJECTED" &&
        request.moderationRejectReason && (
          <FormNotice tone="error">
            Lý do từ chối: {request.moderationRejectReason}
          </FormNotice>
        )}
      {state === "PENDING_MODERATION" && (
        <FormNotice tone="info">
          Bài đang chờ duyệt và chưa nhận đề xuất mới.
        </FormNotice>
      )}
      {state === "MATCHED" && (
        <FormNotice tone="info">
          Lịch học đã khóa. Để dừng hoặc đổi lịch, sử dụng luồng trong lộ trình
          đã liên kết.
        </FormNotice>
      )}
    </>
  );
}
