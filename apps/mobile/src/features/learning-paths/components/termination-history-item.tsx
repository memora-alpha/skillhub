import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Copy } from "@/components/feature-page";
import { useConnections } from "@/features/connections";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import type { TerminationRequest } from "../api/path-changes-contract";
import { terminationLabels } from "../utils/termination-policy";
import { TerminationRequestMetadata } from "./termination-request-metadata";
import { TerminationDecision } from "./termination-decision";

function eventTime(request: TerminationRequest) {
  if (request.status === "EXPIRED")
    return { label: "Hết hạn lúc", at: request.expiresAt };
  if (!request.closedAt) return { label: "Gửi lúc", at: request.createdAt };
  const labels: Partial<Record<TerminationRequest["status"], string>> = {
    WITHDRAWN: "Rút lúc",
    REJECTED: "Từ chối lúc",
    APPLIED: "Xử lý Credit lúc",
  };
  return { label: labels[request.status] ?? "Đóng lúc", at: request.closedAt };
}

export function TerminationHistoryItem({
  request,
  defaultExpanded = false,
  selected = false,
}: Readonly<{
  request: TerminationRequest;
  defaultExpanded?: boolean;
  selected?: boolean;
}>) {
  const runtime = useConnections();
  const [opened, setOpened] = useState<boolean>();
  const expanded = opened ?? defaultExpanded;
  const title = terminationLabels[request.status];
  const event = eventTime(request);
  const when = `${event.label} ${new Date(event.at).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  const applied = request.status === "APPLIED";
  const accent = applied ? colors.forest : colors.muted;
  return (
    <View style={styles.item}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? "Thu gọn" : "Xem chi tiết"}: ${title}, ${when}`}
        accessibilityState={{ expanded }}
        onPress={() => setOpened(!expanded)}
        style={({ pressed }) => [styles.summary, pressed && { opacity: 0.65 }]}
      >
        <View style={[styles.marker, applied && styles.appliedMarker]}>
          <Icon name={applied ? "check" : "close"} size={14} color={accent} />
        </View>
        <View style={styles.content}>
          {selected && (
            <Text style={styles.selected}>Từ thông báo của bạn</Text>
          )}
          <Text style={[styles.title, applied && styles.appliedTitle]}>
            {title}
          </Text>
          <Text style={styles.meta}>
            {runtime.userId === request.requesterId ? "Bạn gửi" : "Đối tác gửi"}{" "}
            · {when}
          </Text>
          {!expanded && (
            <Text numberOfLines={2} style={styles.preview}>
              {request.reason}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.chevron,
            { transform: [{ rotate: expanded ? "90deg" : "0deg" }] },
          ]}
        >
          <Icon name="chevron" size={16} color={colors.muted} />
        </View>
      </Pressable>
      {expanded && (
        <View style={styles.details}>
          <View style={styles.field}>
            <Text style={styles.label}>Lý do hủy</Text>
            <Copy>{request.reason}</Copy>
          </View>
          {request.responseNote && (
            <View style={styles.field}>
              <Text style={styles.label}>Ghi chú phản hồi</Text>
              <Copy>{request.responseNote}</Copy>
            </View>
          )}
          <TerminationRequestMetadata request={request} />
          <TerminationDecision request={request} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: 18,
    gap: 14,
  },
  summary: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    minHeight: 64,
  },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceInset,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  appliedMarker: { backgroundColor: colors.forestSoft },
  content: { flex: 1, gap: 5 },
  title: { ...typography.body, fontFamily: fonts.bold, color: colors.ink },
  appliedTitle: { color: colors.forest },
  meta: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  preview: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.body,
    marginTop: 3,
  },
  chevron: { paddingTop: 6 },
  details: {
    marginLeft: 13,
    paddingLeft: 26,
    borderLeftWidth: 1,
    borderColor: colors.borderStrong,
    gap: 14,
    paddingBottom: 4,
  },
  field: { gap: 5 },
  label: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.muted,
  },
  selected: {
    ...typography.caption,
    fontFamily: fonts.semibold,
    color: colors.info,
  },
});
