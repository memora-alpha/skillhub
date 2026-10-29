import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PathReadFeedback } from "./PathReadFeedback";
import { EmptyState } from "@/components/EmptyState";
import { Copy, RouteButton } from "@/components/feature-page";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { useParticipantProfile } from "@/features/connections";
import {
  appColors as colors,
  appRadius,
  fonts,
  signedInChrome,
  typography,
} from "@/constants/theme";
import { useLearningPaths } from "../hooks/use-learning-paths-api";
import { pathStatusLabel } from "../utils/policy-api";
import type { PathSummary } from "../api/learning-paths-contract";
import {
  filterPathSummaries,
  pathListFilters,
  type PathListFilter,
} from "../utils/path-list-filter";

function exchangeLabel(exchangeType: PathSummary["exchangeType"]) {
  if (exchangeType === "TWO_WAY") return "Trao đổi hai chiều";
  if (exchangeType === "ONE_WAY") return "Học một chiều";
  return "Chưa có hình thức học";
}

function statusIcon(status: PathSummary["status"]) {
  if (["CANCELLED", "DISPUTED"].includes(status)) return "alert" as const;
  if (["CONFIRMED", "SCHEDULED", "ACTIVE", "COMPLETED"].includes(status))
    return "check-circle" as const;
  return "clock" as const;
}

function statusColor(status: PathSummary["status"]) {
  if (["CANCELLED", "DISPUTED"].includes(status)) return colors.error;
  if (["CONFIRMED", "SCHEDULED", "ACTIVE", "COMPLETED"].includes(status))
    return colors.forest;
  return colors.warning;
}

export function ApiPathCard({ path }: Readonly<{ path: PathSummary }>) {
  const profile = useParticipantProfile(path.counterpartId);
  const name = profile.data?.fullName ?? "Lộ trình cùng đối tác";
  const confirmed = ["CONFIRMED", "SCHEDULED", "ACTIVE", "COMPLETED"].includes(
    path.status,
  );
  const closed = ["CANCELLED", "DISPUTED"].includes(path.status);
  const exchangeName = exchangeLabel(path.exchangeType);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar
          name={name}
          userId={path.counterpartId}
          sourceUri={profile.data?.avatarUrl}
          size={40}
        />
        <View style={styles.person}>
          <View style={styles.personLine}>
            <Text
              accessibilityRole="header"
              numberOfLines={1}
              style={styles.name}
            >
              {name}
            </Text>
          </View>
          <Text style={styles.updated}>
            Cập nhật{" "}
            {new Date(path.updatedAt).toLocaleString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        <View style={styles.version}>
          <Text style={styles.versionText}>Bản {path.currentVersion}</Text>
        </View>
      </View>
      <View style={styles.details}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>HÌNH THỨC HỌC</Text>
          <Text style={styles.exchangeTitle}>{exchangeName}</Text>
        </View>
        <View
          style={[
            styles.status,
            confirmed && styles.confirmedStatus,
            closed && styles.closedStatus,
          ]}
        >
          <Icon
            name={statusIcon(path.status)}
            size={15}
            color={statusColor(path.status)}
          />
          <Text
            style={[
              styles.statusText,
              confirmed && styles.confirmedText,
              closed && styles.closedText,
            ]}
          >
            {pathStatusLabel[path.status]}
          </Text>
        </View>
      </View>
      <RouteButton href={`/paths/${path.id}`}>Mở lộ trình</RouteButton>
    </View>
  );
}
export function ApiPathsContent() {
  const query = useLearningPaths();
  const [filter, setFilter] = useState<PathListFilter>("all");
  const paths = query.data ?? [];
  const visible = filterPathSummaries(paths, filter);
  return (
    <>
      <PathReadFeedback query={query} />
      {!!query.data?.length && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <View
            style={styles.filters}
            accessibilityRole="radiogroup"
            accessibilityLabel="Lọc trạng thái lộ trình"
          >
            {pathListFilters.map((item) => {
              const checked = item.value === filter;
              const count = filterPathSummaries(paths, item.value).length;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="radio"
                  accessibilityLabel={`${item.label} (${count})`}
                  accessibilityState={{ checked }}
                  aria-checked={checked}
                  onPress={() => setFilter(item.value)}
                  style={[styles.filter, checked && styles.selectedFilter]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      checked && styles.selectedFilterText,
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      styles.filterCount,
                      checked && styles.selectedFilterCount,
                    ]}
                  >
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
      {visible.map((path) => (
        <ApiPathCard key={path.id} path={path} />
      ))}
      {query.data?.length === 0 && (
        <EmptyState
          title="Chưa có lộ trình"
          description="Mở cuộc trò chuyện sau khi đề xuất được chấp nhận để cùng tạo lộ trình học."
        />
      )}
      {!!query.data?.length && visible.length === 0 && (
        <EmptyState
          title="Chưa có lộ trình ở trạng thái này"
          description="Chọn Tất cả để xem các lộ trình còn lại."
        />
      )}
      {query.data?.length === 100 && (
        <Copy muted size="hint">
          Đang hiển thị tối đa 100 lộ trình được cập nhật gần nhất. Số lượng bộ
          lọc tính trong danh sách đã tải.
        </Copy>
      )}
    </>
  );
}
const styles = StyleSheet.create({
  card: {
    position: "relative",
    overflow: "hidden",
    padding: 16,
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  person: { flex: 1, minWidth: 0, gap: 4 },
  personLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
  },
  name: {
    flex: 1,
    minWidth: 0,
    ...typography.body,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  version: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: appRadius.badge,
    backgroundColor: colors.surfaceLow,
  },
  versionText: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.muted,
  },
  status: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: appRadius.badge,
    backgroundColor: colors.amberSoft,
  },
  statusText: {
    flexShrink: 1,
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.warning,
  },
  confirmedStatus: { backgroundColor: colors.forestSoft },
  confirmedText: { color: colors.forest },
  closedStatus: { backgroundColor: colors.errorLight },
  closedText: { color: colors.error },
  details: { gap: 9 },
  titleBlock: { gap: 2 },
  eyebrow: {
    ...typography.caption,
    fontFamily: fonts.bold,
    color: colors.muted,
    letterSpacing: 0.5,
  },
  exchangeTitle: {
    ...typography.heading,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  updated: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  filters: { flexDirection: "row", alignItems: "center", gap: 8 },
  filter: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: appRadius.full,
    borderWidth: 1,
    borderColor: signedInChrome.border,
    backgroundColor: colors.surface,
  },
  selectedFilter: {
    backgroundColor: colors.primarySoft,
    borderColor: signedInChrome.accent,
  },
  filterText: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.body,
  },
  selectedFilterText: { color: signedInChrome.accent },
  filterCount: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    overflow: "hidden",
    borderRadius: appRadius.full,
    textAlign: "center",
    textAlignVertical: "center",
    ...typography.caption,
    fontFamily: fonts.semibold,
    color: colors.muted,
    backgroundColor: colors.surfaceLow,
  },
  selectedFilterCount: {
    color: signedInChrome.accent,
    backgroundColor: colors.surface,
  },
});
