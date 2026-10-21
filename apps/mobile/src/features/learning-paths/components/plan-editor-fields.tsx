import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useWatch, type Control } from "react-hook-form";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { ControlledInput } from "@/components/ControlledInput";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import type { PlanEditorValues } from "../schemas/plan-editor-input";

export function PlanEditorFrame({
  children,
  action,
}: Readonly<{ children: ReactNode; action: ReactNode }>) {
  return (
    <View style={styles.frame}>
      <KeyboardFormScrollView
        style={styles.frame}
        contentContainerStyle={styles.content}
      >
        {children}
      </KeyboardFormScrollView>
      <View style={styles.footer}>{action}</View>
    </View>
  );
}
export function PlanSkillPicker({
  options,
  value,
  selectedName,
  disabled,
  onChange,
  hasMore,
  loadingMore,
  onLoadMore,
}: Readonly<{
  options: readonly { id: string; name: string }[];
  value: string;
  selectedName?: string;
  disabled: boolean;
  onChange: (id: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore: () => void;
}>) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const visibleOptions = options.filter((option) =>
    option.name
      .toLocaleLowerCase("vi")
      .includes(search.trim().toLocaleLowerCase("vi")),
  );
  const selected =
    options.find((option) => option.id === value)?.name ?? selectedName;
  return (
    <View style={styles.group}>
      <View style={styles.heading}>
        <Text style={styles.label}>
          Kỹ năng dạy <Text style={styles.required}>*</Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Thu gọn kỹ năng" : "Xem thêm kỹ năng"}
          aria-expanded={expanded}
          disabled={disabled}
          onPress={() => setExpanded(!expanded)}
          style={styles.more}
        >
          <Text style={styles.link}>{expanded ? "Thu gọn" : "Xem thêm"}</Text>
          <Icon name="chevron" size={14} color={colors.primary} />
        </Pressable>
      </View>
      {value ? (
        <View style={styles.chips}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Kỹ năng đang chọn: ${selected ?? "Đã chọn"}`}
            disabled={disabled}
            onPress={() => setExpanded(!expanded)}
            style={[styles.chip, styles.selected]}
          >
            <Text style={styles.selectedLabel}>
              {selected ?? "Kỹ năng đã chọn"}
            </Text>
            <Icon name="check" size={14} color={colors.primary} />
          </Pressable>
        </View>
      ) : (
        <Button
          variant="secondary"
          disabled={disabled}
          onPress={() => setExpanded(true)}
        >
          Chọn kỹ năng
        </Button>
      )}
      {expanded && (
        <View style={styles.options}>
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.muted} />
            <TextInput
              accessibilityLabel="Tìm kỹ năng trong danh mục đã tải"
              placeholder="Tìm kỹ năng…"
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
              editable={!disabled}
              style={styles.searchInput}
            />
          </View>
          <View style={styles.chips}>
            {visibleOptions.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityLabel={option.name}
                accessibilityState={{ checked: value === option.id, disabled }}
                aria-checked={value === option.id}
                disabled={disabled}
                onPress={() => {
                  onChange(option.id);
                  setExpanded(false);
                  setSearch("");
                }}
                style={[
                  styles.chip,
                  value === option.id && styles.selected,
                  disabled && styles.disabled,
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    value === option.id && styles.selectedLabel,
                  ]}
                >
                  {option.name}
                </Text>
                {value === option.id && (
                  <Icon name="check" size={12} color={colors.primary} />
                )}
              </Pressable>
            ))}
          </View>
          {!visibleOptions.length && (
            <Text style={styles.counter}>
              Không có kỹ năng phù hợp trong danh sách đã tải.
            </Text>
          )}
          {hasMore && (
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled || loadingMore}
              onPress={onLoadMore}
            >
              {loadingMore ? "Đang tải…" : "Tải thêm kỹ năng"}
            </Button>
          )}
        </View>
      )}
    </View>
  );
}
export function PlanGoalField({
  control,
  disabled,
}: Readonly<{ control: Control<PlanEditorValues>; disabled: boolean }>) {
  const value = useWatch({ control, name: "learningGoal" }) ?? "";
  return (
    <View style={styles.group}>
      <View style={styles.heading}>
        <Text style={styles.label}>
          Mục tiêu học <Text style={styles.required}>*</Text>
        </Text>
        <Text style={styles.counter}>{value.length}/1500</Text>
      </View>
      <ControlledInput
        control={control}
        name="learningGoal"
        label="Mục tiêu học"
        hideLabel
        reserveMessageSpace={false}
        multiline
        maxLength={1500}
        editable={!disabled}
        placeholder="Người học sẽ làm được gì sau lộ trình?"
      />
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 24 },
  footer: {
    padding: 12,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  group: {
    gap: 12,
    padding: 16,
    borderRadius: appRadius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  label: { ...typography.body, fontFamily: fonts.semibold, color: colors.ink },
  required: { color: colors.primary },
  counter: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  more: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  link: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: appRadius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLow,
  },
  selected: {
    borderColor: colors.primaryMuted,
    backgroundColor: colors.primarySoft,
  },
  chipLabel: {
    ...typography.body,
    fontFamily: fonts.medium,
    color: colors.body,
  },
  selectedLabel: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  disabled: { opacity: 0.5 },
  options: {
    gap: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    minHeight: 48,
    borderRadius: appRadius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLow,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    ...typography.body,
    fontFamily: fonts.body,
    color: colors.ink,
  },
});
