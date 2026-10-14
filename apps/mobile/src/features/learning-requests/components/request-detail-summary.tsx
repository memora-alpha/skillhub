import { Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { uiLabel } from "@/constants/ui-copy";
import { useSkillName } from "../hooks/use-requests";
import {
  dateLabel,
  isOwnRequest,
  requestState,
  statusLabels,
} from "../utils/request-policy";
import type { OwnerRequest, PublicRequestDetail } from "../types";
import { RequestDetailTag } from "./request-detail-tag";
import { RequestOwnerTags } from "./request-owner-tags";
import {
  requestDetailColors as colors,
  requestDetailStyles as styles,
} from "./request-detail.styles";

export function RequestDetailSummary({
  request,
}: Readonly<{
  request: OwnerRequest | PublicRequestDetail;
}>) {
  const own = isOwnRequest(request);
  const skill = useSkillName(own ? request.skillId : undefined);
  const state = requestState(request);
  let statusColor: string = colors.body;
  let statusBackground: string = colors.surfaceLow;
  if (state === "DRAFT" || state === "PENDING_MODERATION") {
    statusColor = colors.warning;
    statusBackground = colors.amberSoft;
  } else if (state === "OPEN") {
    statusColor = colors.success;
    statusBackground = colors.successSoft;
  } else if (state === "REJECTED" || state === "CANCELLED") {
    statusColor = colors.error;
    statusBackground = colors.errorLight;
  }
  const moderationApproved = own && request.moderationStatus === "APPROVED";
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View
          style={[
            styles.pill,
            {
              backgroundColor: statusBackground,
              borderColor: statusBackground,
            },
          ]}
        >
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: statusColor,
            }}
          />
          <Text style={[styles.pillText, { color: statusColor }]}>
            {statusLabels[state]}
          </Text>
        </View>
        {own && request.moderationStatus !== "NOT_REQUIRED" && (
          <View
            style={[
              styles.pill,
              moderationApproved && {
                backgroundColor: colors.successSoft,
                borderColor: colors.forestMuted,
              },
            ]}
          >
            {moderationApproved && (
              <Icon name="check" size={13} color={colors.success} />
            )}
            <Text
              style={[
                styles.pillText,
                moderationApproved && { color: colors.success },
              ]}
            >
              Kiểm duyệt: {uiLabel(request.moderationStatus)}
            </Text>
          </View>
        )}
      </View>
      <Text selectable accessibilityRole="header" style={styles.title}>
        {request.title}
      </Text>
      <View style={[styles.metadataRow, { alignItems: "flex-start" }]}>
        <Icon name="book" size={16} color={colors.primary} />
        <Text selectable style={[styles.emphasis, { flex: 1 }]}>
          {own
            ? (skill.data?.name ?? "Thông tin kỹ năng chưa khả dụng")
            : request.skill.name}
        </Text>
      </View>
      <Text style={styles.caption}>
        Trình độ hiện tại:{" "}
        {request.currentLevel
          ? uiLabel(request.currentLevel)
          : "Chưa khai trình độ"}
      </Text>
      {(own ? request.tagIds.length > 0 : request.tags.length > 0) && (
        <View style={{ gap: 8 }}>
          <Text style={styles.caption}>Chủ đề</Text>
          {own ? (
            <RequestOwnerTags ids={request.tagIds} detail />
          ) : (
            <View style={styles.topicList}>
              {request.tags.map((tag) => (
                <RequestDetailTag key={tag.id} label={tag.label} />
              ))}
            </View>
          )}
        </View>
      )}
      <View style={styles.meta}>
        <View style={styles.metadataRow}>
          <Icon name="clock" size={14} color={colors.muted} />
          <Text selectable style={[styles.caption, { flex: 1 }]}>
            {own && request.publishedAt ? "Đã đăng" : "Ngày tạo"}:{" "}
            {dateLabel(
              own
                ? (request.publishedAt ?? request.createdAt)
                : request.createdAt,
            )}
          </Text>
        </View>
        {request.expiresAt && (
          <View style={styles.metadataRow}>
            <Icon name="calendar" size={14} color={colors.muted} />
            <Text selectable style={[styles.caption, { flex: 1 }]}>
              Hạn yêu cầu: {dateLabel(request.expiresAt)}
            </Text>
          </View>
        )}
        {request.verifiedTeacherOnly && (
          <Text style={styles.caption}>
            Chỉ nhận người dạy có kỹ năng này đã được xác minh.
          </Text>
        )}
      </View>
    </View>
  );
}
