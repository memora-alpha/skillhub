import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/components/AppScreenLayout";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { LearningRequestRow } from "../components/LearningRequestRow";
import {
  learningRequests,
  requestFilters,
  type RequestCategory,
} from "../mocks/requests";
import { colors, fonts, radius } from "@/constants/theme";

type AdvancedFilter = "all" | "credit" | "sessions";

export function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string | string[] }>();
  const query =
    typeof params.query === "string" ? params.query : (params.query?.[0] ?? "");
  const [filter, setFilter] = useState<RequestCategory>("Tất cả");
  const [search, setSearch] = useState(query);
  const [searchFocused, setSearchFocused] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedFilter, setAdvancedFilter] = useState<AdvancedFilter>("all");
  useEffect(() => setSearch(query), [query]);
  const requests = learningRequests.filter(
    (item) =>
      (filter === "Tất cả" || item.category === filter) &&
      (advancedFilter === "all" ||
        (advancedFilter === "credit" &&
          Number.parseInt(item.budget, 10) >= 60) ||
        (advancedFilter === "sessions" && item.sessions >= 8)) &&
      (!search ||
        `${item.title} ${item.user} ${item.tags.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase())),
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
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            contentContainerStyle={styles.content}
            ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
            ListHeaderComponent={
              <View style={styles.header}>
                <View style={styles.filters}>
                  {requestFilters.map((label) => (
                    <Pressable
                      key={label}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: filter === label }}
                      aria-selected={filter === label}
                      onPress={() => setFilter(label)}
                      style={({ pressed }) => [
                        styles.filter,
                        filter === label && styles.activeFilter,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterLabel,
                          filter === label && { color: colors.brandHover },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.searchRow}>
                  <View
                    style={[
                      styles.search,
                      searchFocused && { borderColor: colors.brand },
                    ]}
                  >
                    <Icon name="search" size={16} color={colors.muted} />
                    <TextInput
                      accessibilityLabel="Tìm yêu cầu học"
                      value={search}
                      onChangeText={setSearch}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setSearchFocused(false)}
                      placeholder="Tìm kỹ năng, người học..."
                      placeholderTextColor={colors.mutedLight}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                      style={styles.searchInput}
                    />
                    {!!search && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Xóa tìm kiếm"
                        onPress={() => setSearch("")}
                        hitSlop={8}
                      >
                        <Icon name="close" size={16} color={colors.muted} />
                      </Pressable>
                    )}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Hiện bộ lọc nâng cao"
                    accessibilityState={{ expanded: advancedOpen }}
                    onPress={() => setAdvancedOpen((open) => !open)}
                    style={({ pressed }) => [
                      styles.advancedToggle,
                      advancedOpen && styles.advancedToggleActive,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Icon
                      name="settings"
                      size={16}
                      color={advancedOpen ? colors.white : colors.brand}
                    />
                    <Text
                      style={[
                        styles.advancedToggleLabel,
                        advancedOpen && { color: colors.white },
                      ]}
                    >
                      Lọc
                    </Text>
                  </Pressable>
                </View>
                {advancedOpen && (
                  <View style={styles.advancedFilters}>
                    <Text style={styles.advancedLabel}>Lọc nhanh</Text>
                    <View style={styles.advancedChoices}>
                      {[
                        ["all", "Tất cả"],
                        ["credit", "Từ 60 CR"],
                        ["sessions", "Từ 8 buổi"],
                      ].map(([value, label]) => {
                        const selected = advancedFilter === value;
                        return (
                          <Pressable
                            key={value}
                            accessibilityRole="button"
                            accessibilityLabel={`Lọc ${label}`}
                            accessibilityState={{ selected }}
                            onPress={() =>
                              setAdvancedFilter(value as AdvancedFilter)
                            }
                            style={({ pressed }) => [
                              styles.advancedChoice,
                              selected && styles.advancedChoiceSelected,
                              pressed && { opacity: 0.75 },
                            ]}
                          >
                            <Text
                              style={[
                                styles.advancedChoiceLabel,
                                selected && { color: colors.white },
                              ]}
                            >
                              {label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
                <View style={styles.resultSummary}>
                  <Text style={styles.resultCount}>
                    {requests.length} yêu cầu
                  </Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <EmptyState
                title="Không tìm thấy yêu cầu học"
                description="Thử kỹ năng khác hoặc bỏ bộ lọc hiện tại."
                action="Bỏ bộ lọc"
                onAction={() => {
                  setFilter("Tất cả");
                  setSearch("");
                  setAdvancedFilter("all");
                }}
              />
            }
            renderItem={({ item }) => (
              <LearningRequestRow
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
    maxWidth: 840,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  header: { gap: 16, marginBottom: 8 },
  filters: {
    flexDirection: "row",
    backgroundColor: colors.sand,
    padding: 4,
    borderRadius: radius.control,
    gap: 4,
  },
  filter: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.control,
  },
  activeFilter: { backgroundColor: colors.white },
  searchRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.white,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  advancedToggle: {
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.brandMuted,
    borderRadius: radius.card,
    backgroundColor: colors.brandLight,
  },
  advancedToggleActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  advancedToggleLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.brand,
  },
  advancedFilters: {
    gap: 8,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.white,
  },
  advancedLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
  advancedChoices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  advancedChoice: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.badge,
    backgroundColor: colors.sand,
  },
  advancedChoiceSelected: { backgroundColor: colors.brand },
  advancedChoiceLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.body,
  },
  filterLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 20,
    color: colors.body,
    textAlign: "center",
  },
  resultSummary: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  resultCount: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  postLabel: {
    fontFamily: fonts.semibold,
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
  },
});
