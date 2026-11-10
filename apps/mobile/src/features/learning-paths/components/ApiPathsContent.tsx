import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "expo-router";
import { RefreshableFlatList } from "@/components/RefreshableFlatList";
import { useVisibleListRows } from "@/components/use-visible-list-rows";
import { Button } from "@/components/Button";
import { PathReadFeedback } from "./PathReadFeedback";
import { EmptyState } from "@/components/EmptyState";
import { RouteButton } from "@/components/feature-page";
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
import { useLearningPathPages } from "../hooks/use-learning-paths-api";
import { pathStatusLabel } from "../utils/policy-api";
import type { PathSummary } from "../api/learning-paths-contract";
import { overviewCard } from "../api/path-overview-contract";
import { PathListHighlight } from "./path-list-highlight";
import { learningStageLabel } from "../utils/path-overview-presentation";
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

export function ApiPathCard({
  path,
  loadProfile = true,
}: Readonly<{ path: PathSummary; loadProfile?: boolean }>) {
  const profile = useParticipantProfile(path.counterpartId, loadProfile);
  const name = profile.data?.fullName ?? "Đối tác";
  const parsed = overviewCard.safeParse(path);
  const overview = parsed.success ? parsed.data : undefined;
  const presentationStatus = overview?.learningStage
    ? (
        {
          PREPARING: "DRAFT",
          WAITING_START: "SCHEDULED",
          LEARNING: "ACTIVE",
          LEARNING_FINISHED: "ACTIVE",
          COMPLETED: "COMPLETED",
          STOPPED: "CANCELLED",
        } as const
      )[overview.learningStage]
    : path.status;
  const confirmed = ["CONFIRMED", "SCHEDULED", "ACTIVE", "COMPLETED"].includes(
    presentationStatus,
  );
  const closed = ["CANCELLED", "DISPUTED"].includes(presentationStatus);
  const exchangeName = exchangeLabel(path.exchangeType);
  return (
    <View style={styles.card}>
      <View style={styles.details}>
        <View style={styles.titleBlock}>
          <Text
            accessibilityRole="header"
            numberOfLines={2}
            style={styles.exchangeTitle}
          >
            {path.title?.trim() || "Lộ trình học cùng đối tác"}
          </Text>
          <Text style={styles.updated}>{exchangeName}</Text>
        </View>
        <View
          style={[
            styles.status,
            confirmed && styles.confirmedStatus,
            closed && styles.closedStatus,
          ]}
        >
          <Icon
            name={statusIcon(presentationStatus)}
            size={15}
            color={statusColor(presentationStatus)}
          />
          <Text
            style={[
              styles.statusText,
              confirmed && styles.confirmedText,
              closed && styles.closedText,
            ]}
          >
            {overview?.learningStage
              ? learningStageLabel(overview.learningStage)
              : pathStatusLabel[path.status]}
          </Text>
        </View>
      </View>
      <View style={styles.header}>
        <Avatar
          name={name}
          userId={path.counterpartId}
          sourceUri={profile.data?.avatarUrl}
          size={32}
        />
        <Text numberOfLines={1} style={styles.partner}>
          Cùng {name}
        </Text>
      </View>
      {overview && <PathListHighlight overview={overview} />}
      {path.status === "DISPUTED" && (
        <Text style={styles.attention}>Có tranh chấp đang xử lý</Text>
      )}
      <RouteButton secondary href={`/paths/${path.id}`}>
        Xem lộ trình
      </RouteButton>
    </View>
  );
}
export function ApiPathsContent() {
  const focused = useIsFocused();
  const query = useLearningPathPages(focused);
  const [filter, setFilter] = useState<PathListFilter>("all");
  const { visibleIds, ...viewability } = useVisibleListRows();
  const paths = query.items;
  const visible = filterPathSummaries(paths, filter);
  const hasMore = !!query.hasNextPage && !query.denied;
  const refresh = () => query.refetch({ cancelRefetch: false });
  const loadMore = () => {
    if (focused && hasMore && !query.isFetching)
      void query.fetchNextPage({ cancelRefetch: false });
  };
  const header = (
    <>
      {!query.isFetchNextPageError && (
        <PathReadFeedback query={{ ...query, refetch: refresh }} />
      )}
      {paths.length > 0 && (
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
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="radio"
                  accessibilityLabel={item.label}
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
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
      {filter !== "all" && hasMore && (
        <Text accessibilityLiveRegion="polite" style={styles.filterHint}>
          Đang lọc trong {paths.length} lộ trình đã tải. Còn lộ trình chưa tải;
          bạn có thể tải thêm bên dưới.
        </Text>
      )}
    </>
  );
  let emptyDescription =
    "Mở cuộc trò chuyện sau khi đề xuất được chấp nhận để cùng tạo lộ trình học.";
  if (hasMore) emptyDescription = "Tải thêm để tiếp tục tìm lộ trình phù hợp.";
  else if (paths.length)
    emptyDescription = "Chọn Tất cả để xem các lộ trình còn lại.";
  const empty = query.data && (
    <EmptyState
      title={
        paths.length
          ? hasMore
            ? "Chưa thấy lộ trình phù hợp trong phần đã tải"
            : "Không có lộ trình ở trạng thái này"
          : "Chưa có lộ trình"
      }
      description={emptyDescription}
    />
  );
  let footer = null;
  if (query.isFetchNextPageError)
    footer = <PathReadFeedback query={{ ...query, refetch: loadMore }} />;
  else if (hasMore)
    footer = (
      <Button variant="paper" disabled={query.isFetching} onPress={loadMore}>
        {query.isFetchingNextPage ? "Đang tải thêm…" : "Tải thêm lộ trình"}
      </Button>
    );
  return (
    <RefreshableFlatList
      data={visible}
      {...viewability}
      extraData={visibleIds}
      keyExtractor={(path) => path.id}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={footer}
      refreshing={query.isRefetching}
      onRefresh={() => void refresh()}
      onEndReached={() => {
        if (filter === "all" && visible.length && !query.error) loadMore();
      }}
      renderItem={({ item }) => (
        <ApiPathCard
          path={item}
          loadProfile={focused && visibleIds.has(item.id)}
        />
      )}
    />
  );
}
const styles = StyleSheet.create({
  list: { paddingBottom: 24, gap: 16 },
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
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  partner: {
    flex: 1,
    ...typography.secondary,
    fontFamily: fonts.medium,
    color: colors.body,
  },
  attention: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.error,
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
  details: { gap: 10 },
  titleBlock: { gap: 4 },
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
  filterHint: {
    marginTop: 8,
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  filter: {
    minHeight: 44,
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
});
