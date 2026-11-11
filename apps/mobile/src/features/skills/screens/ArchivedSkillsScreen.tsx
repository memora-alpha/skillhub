import { View } from "react-native";
import { RefreshableFlatList as FlatList } from "@/components/RefreshableFlatList";
import { SkillsLayout, skillStyles } from "../components/SkillsLayout";
import { ArchivedSkillCard } from "../components/ArchivedSkillCard";
import { QueryFeedback, PageFooter } from "../components/QueryFeedback";
import { useArchivedSkills } from "../hooks/use-archived-skills";
import { uniqueItems } from "../hooks/use-skill-queries";

export function ArchivedSkillsScreen() {
  const query = useArchivedSkills();
  const items = uniqueItems(query.data?.pages).filter(
    (skill) => !!skill.archivedAt,
  );
  return (
    <SkillsLayout title="Kỹ năng đã lưu trữ" scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={skillStyles.content}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => void query.refetch()}
        ListEmptyComponent={
          <QueryFeedback
            query={query}
            empty={!query.error && !query.hasNextPage}
            emptyText="Không có kỹ năng đã lưu trữ."
          />
        }
        renderItem={({ item }) => (
          <View style={{ marginBottom: 12 }}>
            <ArchivedSkillCard
              skill={item}
              canRead={query.canRead}
              reading={query.isFetching || !!query.error}
              onRefresh={query.refetch}
            />
          </View>
        )}
        ListFooterComponent={query.data ? <PageFooter query={query} /> : null}
      />
    </SkillsLayout>
  );
}
