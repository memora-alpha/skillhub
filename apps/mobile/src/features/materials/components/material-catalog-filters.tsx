import { useMemo, useRef, useState } from "react";
import { Host, BottomSheet, RNHostView } from "@expo/ui";
import {
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { appColors, signedInChrome } from "@/constants/theme";
import { SkillSelector } from "@/features/learning-requests";
import { catalogFilterStyles as styles } from "./material-catalog-filters.styles";

export type MaterialCatalogFilter = {
  access: "ALL" | "FREE" | "PAID";
  skillId: string;
};
export const emptyCatalogFilter: MaterialCatalogFilter = {
  access: "ALL",
  skillId: "",
};
const accessLabels = { ALL: "Tất cả", FREE: "Miễn phí", PAID: "Trả phí" };

export function MaterialCatalogFilters({
  search,
  onSearch,
  onSubmit,
  filters,
  onApply,
}: Readonly<{
  search: string;
  onSearch: (value: string) => void;
  onSubmit: () => void;
  filters: MaterialCatalogFilter;
  onApply: (filters: MaterialCatalogFilter) => void;
}>) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(filters);
  const { height } = useWindowDimensions();
  const frame = useRef({ open: false, height: Math.min(height * 0.8, 640) });
  if (open && !frame.current.open)
    frame.current.height = Math.min(height * 0.8, 640);
  frame.current.open = open;
  const sheetHeight = frame.current.height;
  const snapPoints = useMemo(() => [{ height: sheetHeight }], [sheetHeight]);
  const active = Number(filters.access !== "ALL") + Number(!!filters.skillId);
  const close = () => {
    Keyboard.dismiss();
    setOpen(false);
  };
  return (
    <View>
      <View style={styles.row}>
        <View style={[styles.search, focused && styles.focus]}>
          <Icon name="search" size={18} color={appColors.muted} />
          <TextInput
            accessibilityLabel="Tìm tài liệu"
            placeholder="Tìm tài liệu..."
            placeholderTextColor={appColors.muted}
            value={search}
            onChangeText={onSearch}
            maxLength={100}
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
          accessibilityLabel="Bộ lọc tài liệu"
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          onPress={() => {
            Keyboard.dismiss();
            setDraft(filters);
            setOpen(true);
          }}
          style={[styles.filter, (open || !!active) && styles.active]}
        >
          <Icon
            name="filter"
            size={18}
            color={open || active ? signedInChrome.accent : appColors.body}
          />
          <Text style={styles.label}>Lọc{active ? ` (${active})` : ""}</Text>
        </Pressable>
      </View>
      <Host
        style={{ position: "absolute" }}
        pointerEvents="box-none"
        colorScheme="light"
      >
        <BottomSheet
          isPresented={open}
          onDismiss={close}
          snapPoints={snapPoints}
          contentPadding={0}
          containerColor={appColors.surface}
        >
          <RNHostView matchContents={{ vertical: true }}>
            <View
              style={{ height: Math.max(0, sheetHeight - 32), width: "100%" }}
            >
              <View style={styles.sheetHeader}>
                <Text accessibilityRole="header" style={styles.heading}>
                  Bộ lọc tài liệu
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Đóng bộ lọc tài liệu"
                  onPress={close}
                  style={styles.iconButton}
                >
                  <Icon name="close" size={22} color={appColors.body} />
                </Pressable>
              </View>
              <KeyboardFormScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.sheetBody}
              >
                <View style={[styles.row, { justifyContent: "space-between" }]}>
                  <Text style={styles.label}>Tùy chọn hiển thị</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDraft(emptyCatalogFilter)}
                    style={styles.reset}
                  >
                    <Text style={styles.resetText}>Đặt lại</Text>
                  </Pressable>
                </View>
                <View style={styles.section}>
                  <Text style={styles.label}>Giá tài liệu</Text>
                  <View style={styles.choices}>
                    {(["ALL", "FREE", "PAID"] as const).map((value) => (
                      <Pressable
                        key={value}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: draft.access === value }}
                        aria-checked={draft.access === value}
                        onPress={() => setDraft({ ...draft, access: value })}
                        style={[
                          styles.choice,
                          draft.access === value && styles.active,
                        ]}
                      >
                        <Text
                          style={[
                            styles.label,
                            draft.access === value && styles.selectedText,
                          ]}
                        >
                          {accessLabels[value]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.section}>
                  <Text style={styles.label}>Kỹ năng</Text>
                  {open && (
                    <SkillSelector
                      allowAll
                      active={open}
                      value={draft.skillId}
                      onChange={(skillId) => setDraft({ ...draft, skillId })}
                    />
                  )}
                </View>
                <Button
                  variant="craft"
                  onPress={() => {
                    if (!open) return;
                    onApply(draft);
                    close();
                  }}
                >
                  Áp dụng
                </Button>
              </KeyboardFormScrollView>
            </View>
          </RNHostView>
        </BottomSheet>
      </Host>
    </View>
  );
}
