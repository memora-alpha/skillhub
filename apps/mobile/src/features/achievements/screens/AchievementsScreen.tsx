import { useState } from "react";
import { Text, View } from "react-native";
import { FilterBar } from "@/components/filter-bar";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { FeaturePage } from "@/components/feature-page";
import { appColors as colors } from "@/constants/theme";
import { achievementTitleLabel } from "@/constants/achievement-copy";
import { AppError, errorMessage } from "@/lib/http/errors";
import { useAchievements } from "../hooks/use-achievements";
import { AchievementCard } from "../components/achievement-card";
import { achievementStyles as styles } from "../components/achievement.styles";
import {
  achievementGroups,
  achievementGroup,
  achievementIcon,
  orderedAchievements,
  type AchievementGroup,
} from "../utils/achievement-presentation";

export function AchievementsScreen() {
  const { query, mutation, enabled, data } = useAchievements();
  const [filter, setFilter] = useState<AchievementGroup>("Tất cả");
  const [refreshing, setRefreshing] = useState(false);
  const saving = mutation.isPending;
  const locked = saving || query.isFetching || !!query.error;
  const items = orderedAchievements(data?.items ?? []);
  const groups = achievementGroups.filter(
    (group) =>
      group === "Tất cả" ||
      items.some((item) => achievementGroup(item.code) === group),
  );
  const selectedGroup = groups.includes(filter) ? filter : "Tất cả";
  const visible =
    selectedGroup === "Tất cả"
      ? items
      : items.filter((item) => achievementGroup(item.code) === selectedGroup);
  const selected = items.find((item) => item.title === data?.selectedTitle);
  const refresh = async () => {
    if (saving || query.isFetching || refreshing || !enabled) return;
    mutation.reset();
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <FeaturePage
      title="Thành tích & danh hiệu"
      back="/profile"
      compact
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {!enabled ? (
        <Text style={styles.meta}>Đăng nhập để xem thành tích của bạn.</Text>
      ) : (
        <>
          {query.isLoading && (
            <LoadingIndicator accessibilityLabel="Đang tải thành tích" />
          )}
          {query.error && (
            <FormNotice tone="error">{errorMessage(query.error)}</FormNotice>
          )}
          {data === null && (
            <FormNotice tone="info">
              Tài khoản hiện không có quyền xem thành tích.
            </FormNotice>
          )}
          {mutation.error && (
            <FormNotice tone="error">
              {mutation.error instanceof AppError &&
              mutation.error.code === "TITLE_NOT_UNLOCKED"
                ? "Danh hiệu không còn khả dụng. Kéo xuống để cập nhật."
                : "Chưa xác nhận được thay đổi. Kéo xuống để kiểm tra."}
            </FormNotice>
          )}
          {mutation.isSuccess && (
            <FormNotice tone="success" compact>
              {mutation.variables === null
                ? "Đã ẩn danh hiệu trên hồ sơ."
                : "Đã cập nhật danh hiệu trên hồ sơ."}
            </FormNotice>
          )}
          {data && (
            <View style={styles.display}>
              <View style={styles.badge}>
                <Icon
                  name={selected ? achievementIcon(selected.code) : "award"}
                  size={22}
                  color={colors.amber}
                  filled={false}
                />
              </View>
              <View style={styles.grow}>
                <Text style={styles.meta}>
                  Danh hiệu trên hồ sơ · {items.length} thành tích
                </Text>
                <Text selectable style={styles.displayTitle}>
                  {data.selectedTitle
                    ? achievementTitleLabel(data.selectedTitle)
                    : "Chưa chọn danh hiệu"}
                </Text>
              </View>
              {data.selectedTitle && (
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon="eye-off"
                  accessibilityLabel="Ẩn danh hiệu"
                  disabled={locked}
                  style={styles.hideAction}
                  onPress={() => mutation.mutate(null)}
                >
                  {saving && mutation.variables === null ? "Đang lưu…" : "Ẩn"}
                </Button>
              )}
            </View>
          )}
          {data && !items.length && (
            <EmptyState
              icon="award"
              title="Hành trình mới bắt đầu"
              description="Thành tích sẽ xuất hiện khi bạn đạt các mốc học tập và chia sẻ."
              titleStyle={styles.heading}
            />
          )}
          {data && items.length > 0 && (
            <>
              <FilterBar
                options={groups.map((group) => ({
                  value: group,
                  label: group,
                  accessibilityLabel: `Lọc thành tích: ${group}`,
                }))}
                value={selectedGroup}
                onChange={setFilter}
                label="Lọc thành tích"
              />
              <View style={styles.grid}>
                {visible.map((item) => (
                  <AchievementCard
                    key={item.code}
                    item={item}
                    selected={item.title === data.selectedTitle}
                    disabled={locked}
                    saving={saving && mutation.variables === item.code}
                    onSelect={() => mutation.mutate(item.code)}
                  />
                ))}
              </View>
            </>
          )}
        </>
      )}
    </FeaturePage>
  );
}
