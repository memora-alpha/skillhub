import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { appColors, signedInChrome } from "@/constants/theme";
import { useSkillName } from "../hooks/use-requests";
import { SkillSelector } from "./skill-selector";
import { TagSelector } from "./tag-selector";
import { RequestTabs } from "./request-list-controls";
import { requestListStyles as styles } from "./request-list.styles";

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
}: {
  search: string;
  onSearch: (value: string) => void;
  onSubmit: () => void;
  filters: FeedFilters;
  onApply: (value: FeedFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(filters);
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
      {open && (
        <View style={styles.filterPanel}>
          <View style={styles.between}>
            <Text style={styles.heading}>Bộ lọc</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setDraft({ skillId: "", scope: "feed", tagIds: [] })
              }
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
              value={draft.skillId}
              onChange={(skillId) => setDraft({ ...draft, skillId })}
            />
          </View>
          <TagSelector
            value={draft.tagIds}
            onChange={(tagIds) => setDraft({ ...draft, tagIds })}
          />
          <View style={styles.row}>
            <Button variant="ghost" onPress={() => setOpen(false)}>
              Đóng
            </Button>
            <Button
              variant="craft"
              style={styles.apply}
              onPress={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              Áp dụng
            </Button>
          </View>
        </View>
      )}
      {!!active && (
        <View style={styles.chips}>
          {!!filters.tagIds.length && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xóa lọc tag"
              onPress={() => onApply({ ...filters, tagIds: [] })}
              style={styles.chip}
            >
              <Text style={styles.chipText}>{filters.tagIds.length} tag</Text>
              <Icon name="close" size={14} color={appColors.primaryDark} />
            </Pressable>
          )}
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
