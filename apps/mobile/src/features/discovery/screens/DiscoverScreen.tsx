import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/components/AppScreenLayout";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Tag } from "@/components/Tag";
import { LearningRequestCard } from "../components/LearningRequestCard";
import {
  learningRequests,
  requestFilters,
  type RequestCategory,
} from "../mocks/requests";
import { colors, fonts } from "@/constants/theme";

export function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string | string[] }>();
  const query =
    typeof params.query === "string" ? params.query : (params.query?.[0] ?? "");
  const [filter, setFilter] = useState<RequestCategory>("Tất cả");
  const requests = learningRequests.filter(
    (item) =>
      (filter === "Tất cả" || item.category === filter) &&
      (!query ||
        `${item.title} ${item.user} ${item.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase())),
  );
  return (
    <AppScreenLayout
      title="Yêu cầu học"
      selected="Khám phá"
      rightAction={(open) => (
        <Button
          size="sm"
          onPress={() => open("Đăng yêu cầu học")}
          accessibilityLabel="Đăng yêu cầu học"
        >
          <Icon name="plus" size={14} color={colors.white} />
          <Text style={styles.postLabel}>Đăng</Text>
        </Button>
      )}
    >
      {() => (
        <>
          <FlatList
            data={requests}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            contentContainerStyle={styles.content}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            ListHeaderComponent={
              <View style={styles.filters}>
                {requestFilters.map((label) => (
                  <Tag
                    key={label}
                    label={label}
                    active={filter === label}
                    onPress={() => setFilter(label)}
                  />
                ))}
                {!!query && (
                  <Tag
                    label={`${query} ×`}
                    onPress={() => router.setParams({ query: "" })}
                  />
                )}
              </View>
            }
            ListEmptyComponent={
              <EmptyState
                title="Không tìm thấy yêu cầu học"
                description="Thử kỹ năng khác hoặc bỏ bộ lọc hiện tại."
                action="Bỏ bộ lọc"
                onAction={() => {
                  setFilter("Tất cả");
                  router.setParams({ query: "" });
                }}
              />
            }
            renderItem={({ item }) => (
              <LearningRequestCard
                request={item}
                onPress={() =>
                  router.push({
                    pathname: "/request/[id]",
                    params: { id: item.id },
                  })
                }
              />
            )}
          />
        </>
      )}
    </AppScreenLayout>
  );
}
const styles = StyleSheet.create({
  list: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  postLabel: {
    fontFamily: fonts.semibold,
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
  },
});
