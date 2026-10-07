import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { LearningRequestRow } from "../components/LearningRequestRow";
import {
  learningRequests,
  requestFilters,
  type RequestCategory,
} from "../mocks/requests";
import { iconSizes } from "@/constants/theme";
import { discoveryColors as colors } from "../constants/theme";
import { styles } from "./DiscoverScreen.styles";

type AdvancedFilter = "all" | "credit" | "sessions";

function renderPostAction(open: (label: string) => void) {
  return (
    <Button
      size="sm"
      variant="craft"
      style={styles.postButton}
      onPress={() => open("Đăng yêu cầu học")}
      accessibilityLabel="Đăng yêu cầu học"
    >
      <Icon name="plus" size={14} color={colors.surface} />
      <Text style={styles.postLabel}>Đăng</Text>
    </Button>
  );
}

function RequestSeparator() {
  return <View style={styles.separator} />;
}

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
  const [oldestFirst, setOldestFirst] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
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
  // Demo fixtures are already ordered from newest to oldest.
  const sortedRequests = oldestFirst ? [...requests].reverse() : requests;
  return (
    <AppScreenLayout
      title="Yêu cầu học"
      selected="Khám phá"
      contentStyle={styles.background}
      rightAction={renderPostAction}
    >
      {() => (
        <>
          <FlatList
            data={sortedRequests}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            contentContainerStyle={styles.content}
            ItemSeparatorComponent={RequestSeparator}
            ListHeaderComponent={
              <View style={styles.header}>
                <View style={styles.searchRow}>
                  <View
                    style={[
                      styles.search,
                      searchFocused && { borderColor: colors.orange },
                    ]}
                  >
                    <Icon name="search" size={iconSizes.control} color={colors.muted} />
                    <TextInput
                      accessibilityLabel="Tìm yêu cầu học"
                      value={search}
                      onChangeText={setSearch}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setSearchFocused(false)}
                      placeholder="Tìm kỹ năng, người học..."
                      placeholderTextColor={colors.muted}
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
                        <Icon name="close" size={iconSizes.control} color={colors.muted} />
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
                      (advancedOpen ||
                        filter !== "Tất cả" ||
                        advancedFilter !== "all") &&
                        styles.advancedToggleActive,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Icon name="filter" size={iconSizes.control} color={colors.orange} />
                    <Text style={[styles.advancedToggleLabel]}>Lọc</Text>
                  </Pressable>
                </View>
                {advancedOpen && (
                  <View style={styles.advancedFilters}>
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
                              filter === label && { color: colors.orange },
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
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
                                selected && { color: colors.orange },
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
                  <View style={styles.countRow}>
                    <View style={styles.resultDot} />
                    <Text style={styles.resultCount}>
                      <Text style={styles.count}>
                        {requests.length} yêu cầu
                      </Text>{" "}
                      đang tìm mentor
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Sắp xếp yêu cầu"
                    accessibilityState={{ expanded: sortOpen }}
                    onPress={() => setSortOpen((open) => !open)}
                    style={styles.sortButton}
                  >
                    <Text style={styles.sortLabel}>
                      {oldestFirst ? "Cũ nhất" : "Mới nhất"}
                    </Text>
                    <View style={{ transform: [{ rotate: "90deg" }] }}>
                      <Icon name="chevron" size={iconSizes.inline} color={colors.muted} />
                    </View>
                  </Pressable>
                </View>
                {sortOpen && (
                  <View style={styles.sortChoices}>
                    {[false, true].map((oldest) => (
                      <Pressable
                        key={String(oldest)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: oldestFirst === oldest }}
                        onPress={() => {
                          setOldestFirst(oldest);
                          setSortOpen(false);
                        }}
                        style={styles.sortChoice}
                      >
                        <Text
                          style={[
                            styles.sortLabel,
                            oldestFirst === oldest && { color: colors.orange },
                          ]}
                        >
                          {oldest ? "Cũ nhất" : "Mới nhất"}
                        </Text>
                        {oldestFirst === oldest && (
                          <Icon name="check" size={14} color={colors.orange} />
                        )}
                      </Pressable>
                    ))}
                  </View>
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
