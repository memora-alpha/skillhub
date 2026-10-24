import { useCallback, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { appColors, signedInChrome } from "@/constants/theme";
import { useSkillName } from "../hooks/use-requests";
import { SkillSelector } from "./skill-selector";
import { TagSelector } from "./tag-selector";
import { RequestTabs } from "./request-list-controls";
import { requestListStyles as styles } from "./request-list.styles";
import { RequestPickerSheet } from "./request-picker-sheet";
import type { TagOption } from "../types";

export type FeedFilters = {
  skillId: string;
  scope: "feed" | "recommended";
  tagIds: string[];
};
export function RequestFeedFilters({
  search,
  onSearch,
  onSubmit,
  filters,
  onApply,
}: Readonly<{
  search: string;
  onSearch: (value: string) => void;
  onSubmit: () => void;
  filters: FeedFilters;
  onApply: (value: FeedFilters) => void;
}>) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [tagLabels, setTagLabels] = useState<Record<string, string>>({});
  const rememberTags = useCallback((options: TagOption[]) => {
    setTagLabels((previous) => {
      if (options.every((tag) => previous[tag.id] === tag.label))
        return previous;
      return {
        ...previous,
        ...Object.fromEntries(options.map((tag) => [tag.id, tag.label])),
      };
    });
  }, []);
  const skill = useSkillName(filters.skillId || undefined);
  const active =
    Number(!!filters.skillId) +
    Number(filters.scope === "recommended") +
    filters.tagIds.length;
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.row}>
        <View style={[styles.search, focused && styles.focus]}>
          <Icon name="search" size={18} color={appColors.muted} />
          <TextInput
            accessibilityLabel="Tìm yêu cầu học"
            placeholder="Tìm yêu cầu học..."
            placeholderTextColor={appColors.muted}
            value={search}
            onChangeText={onSearch}
            maxLength={120}
            returnKeyType="search"
            onSubmitEditing={onSubmit}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={styles.input}
          />
          {!!search && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xóa từ khóa"
              onPress={() => onSearch("")}
              style={styles.iconButton}
            >
              <Icon name="close" size={16} color={appColors.muted} />
            </Pressable>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bộ lọc yêu cầu học"
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          onPress={() => {
            setDraft(filters);
            setOpen(!open);
          }}
          style={[
            styles.filterButton,
            (open || !!active) && styles.selectedFilter,
          ]}
        >
          <Icon
            name="filter"
            size={18}
            color={active || open ? signedInChrome.accent : appColors.body}
          />
          <Text style={styles.filterLabel}>
            Lọc{active ? ` (${active})` : ""}
          </Text>
        </Pressable>
      </View>
      <RequestPickerSheet
        title="Bộ lọc yêu cầu học"
        open={open}
        onClose={() => setOpen(false)}
        closeLabel="Đóng bộ lọc yêu cầu học"
        closeIcon
      >
        <View style={styles.between}>
          <Text style={styles.label}>Tùy chọn hiển thị</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDraft({ skillId: "", scope: "feed", tagIds: [] })}
            style={styles.reset}
          >
            <Text style={styles.resetText}>Đặt lại</Text>
          </Pressable>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Hiển thị</Text>
          <RequestTabs
            label="Loại yêu cầu"
            options={["Tất cả yêu cầu", "Phù hợp với tôi"]}
            value={
              draft.scope === "feed" ? "Tất cả yêu cầu" : "Phù hợp với tôi"
            }
            onChange={(value) =>
              setDraft({
                ...draft,
                scope: value === "Tất cả yêu cầu" ? "feed" : "recommended",
              })
            }
          />
        </View>
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Kỹ năng</Text>
          <SkillSelector
            allowAll
            active={open}
            value={draft.skillId}
            onChange={(skillId) => setDraft({ ...draft, skillId })}
          />
        </View>
        <TagSelector
          active={open}
          value={draft.tagIds}
          onChange={(tagIds) => setDraft({ ...draft, tagIds })}
          onOptions={rememberTags}
          selectedOptions={Object.entries(tagLabels).map(([id, label]) => ({
            id,
            label,
          }))}
        />
        <View style={styles.row}>
          <Button
            variant="craft"
            style={styles.apply}
            onPress={() => {
              if (!open) return;
              onApply(draft);
              setOpen(false);
            }}
          >
            Áp dụng
          </Button>
        </View>
      </RequestPickerSheet>
      {!!active && (
        <View style={styles.chips}>
          {filters.tagIds.map((id, index) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`Xóa lọc tag ${tagLabels[id] ?? index + 1}`}
              onPress={() =>
                onApply({
                  ...filters,
                  tagIds: filters.tagIds.filter((tagId) => tagId !== id),
                })
              }
              style={styles.chip}
            >
              <Text numberOfLines={1} style={styles.chipText}>
                {tagLabels[id] ?? `Tag đã chọn ${index + 1}`}
              </Text>
              <Icon name="close" size={14} color={appColors.primaryDark} />
            </Pressable>
          ))}
          {!!filters.skillId && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xóa lọc kỹ năng"
              onPress={() => onApply({ ...filters, skillId: "" })}
              style={styles.chip}
            >
              <Text numberOfLines={1} style={styles.chipText}>
                {skill.data?.name ?? "Kỹ năng đã chọn"}
              </Text>
              <Icon name="close" size={14} color={appColors.primaryDark} />
            </Pressable>
          )}
          {filters.scope === "recommended" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xóa lọc phù hợp với tôi"
              onPress={() => onApply({ ...filters, scope: "feed" })}
              style={styles.chip}
            >
              <Text style={styles.chipText}>Phù hợp với tôi</Text>
              <Icon name="close" size={14} color={appColors.primaryDark} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
