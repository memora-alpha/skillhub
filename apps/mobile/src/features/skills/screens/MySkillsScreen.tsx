import { RefreshableFlatList as FlatList } from "@/components/RefreshableFlatList";
import { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { appColors } from "@/constants/theme";
import { SkillAction } from "../components/SkillAction";
import { useOwnSkills, uniqueItems } from "../hooks/use-skill-queries";
import { SkillsLayout, skillStyles } from "../components/SkillsLayout";
import { SkillCard } from "../components/SkillCard";
import { QueryFeedback, PageFooter } from "../components/QueryFeedback";
import { SkillFilters } from "../components/SkillFilters";
import type { SkillFilter } from "../utils/skill-filter";
import type { OwnSkill } from "../types/skills";
import { useSkills } from "../context/SkillsProvider";
import { ownSkillItems } from "../utils/own-skill-order";

const emptyLabels: Record<SkillFilter, string> = {
  ALL: "Chưa có kỹ năng. Chọn Thêm kỹ năng để bắt đầu.",
  VERIFIED: "Chưa có kỹ năng đã xác minh.",
  PENDING: "Không có kỹ năng đang chờ xác minh.",
  UNVERIFIED: "Không có kỹ năng chưa xác minh.",
};
export function MySkillsScreen() {
  const [filter, setFilter] = useState<SkillFilter>("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const list = useRef<FlatList<OwnSkill>>(null);
  const query = useOwnSkills(filter);
  const { recentlyCreatedSkills, deletedSkillIds, submittedVerifications } =
    useSkills();
  const items = ownSkillItems(
    uniqueItems(query.data?.pages),
    recentlyCreatedSkills,
    filter,
    deletedSkillIds,
    submittedVerifications,
  );
  const router = useRouter();
  const refresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <SkillsLayout title="Kỹ năng của tôi" scroll={false} fallback="/profile">
      <View style={[skillStyles.content, { gap: 12, paddingBottom: 8 }]}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <SkillAction
            label="Thêm kỹ năng"
            icon="plus"
            outlined
            onPress={() => router.push("/my-skills/new")}
          />
          <View style={{ width: 20, height: 20 }}>
            {query.isFetching && (
              <ActivityIndicator
                size="small"
                color={appColors.primary}
                accessibilityLabel="Đang cập nhật kỹ năng"
              />
            )}
          </View>
        </View>
        <SkillFilters
          value={filter}
          onChange={(next) => {
            if (next === filter) return;
            setRefreshing(false);
            setFilter(next);
            list.current?.scrollToOffset({ offset: 0, animated: false });
          }}
        />
      </View>
      <FlatList
        ref={list}
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[skillStyles.content, { paddingTop: 8 }]}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        ListHeaderComponent={
          items.length && !query.data && query.error ? (
            <QueryFeedback query={query} />
          ) : null
        }
        ListEmptyComponent={
          query.isPlaceholderData ? null : (
            <QueryFeedback
              query={query}
              empty={!query.error}
              emptyText={emptyLabels[filter]}
            />
          )
        }
        renderItem={({ item }) => (
          <View style={{ marginBottom: 12 }}>
            <SkillCard
              skill={item}
              onPress={() =>
                router.push({
                  pathname: "/my-skills/[sharingSkillId]",
                  params: { sharingSkillId: item.id },
                })
              }
            />
          </View>
        )}
        ListFooterComponent={
          query.data && !query.isPlaceholderData && items.length ? (
            <PageFooter query={query} />
          ) : null
        }
      />
    </SkillsLayout>
  );
}
