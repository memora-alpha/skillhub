import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Input } from "@/components/Input";
import { Icon } from "@/components/Icon";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import { useCatalog, uniqueItems } from "../hooks/use-skill-queries";
import { QueryFeedback, PageFooter } from "./QueryFeedback";
import { skillStyles } from "./SkillsLayout";
import type { CatalogSkill } from "../types/skills";

export function CatalogListModal({
  open,
  search,
  selected,
  disabled,
  onSearch,
  onClose,
  onSelect,
}: Readonly<{
  open: boolean;
  search: string;
  selected?: CatalogSkill;
  disabled: boolean;
  onSearch: (value: string) => void;
  onClose: () => void;
  onSelect: (skill: CatalogSkill) => void;
}>) {
  const query = useCatalog(search, open);
  const length = [...search.trim().normalize("NFC")].length;
  const invalid = length === 1 || length > 100;
  const items = uniqueItems(query.data?.pages);
  return (
    <Modal visible={open} onRequestClose={onClose} animationType="slide">
      <SafeAreaView style={skillStyles.screen}>
        <View style={skillStyles.content}>
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text accessibilityRole="header" style={styles.title}>
                Danh mục kỹ năng
              </Text>
              <Text style={skillStyles.caption}>
                Chọn kỹ năng bạn muốn chia sẻ
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đóng danh mục"
              onPress={onClose}
              style={styles.close}
            >
              <Icon name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>
          <Input
            label="Tìm trong danh mục kỹ năng"
            placeholder="Ví dụ: React, Tiếng Anh…"
            value={search}
            onChangeText={onSearch}
            editable={!disabled}
            autoCorrect={false}
            error={invalid ? "Nhập từ 2 đến 100 ký tự để tìm kiếm." : undefined}
          />
        </View>
        {!invalid && (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              skillStyles.content,
              { paddingTop: 0, gap: 10 },
            ]}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <QueryFeedback
                query={query}
                empty={items.length === 0}
                emptyText="Không tìm thấy kỹ năng. Thử từ khóa khác."
              />
            }
            renderItem={({ item }) => {
              const checked = selected?.id === item.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  accessibilityState={{
                    selected: checked,
                    disabled: disabled || item.status !== "ACTIVE",
                  }}
                  disabled={disabled || item.status !== "ACTIVE"}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.item,
                    checked && styles.selected,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    {!!item.description && (
                      <Text numberOfLines={2} style={skillStyles.caption}>
                        {item.description}
                      </Text>
                    )}
                  </View>
                  <Icon
                    name={checked ? "check-circle" : "plus"}
                    size={20}
                    color={checked ? colors.primary : colors.muted}
                  />
                </Pressable>
              );
            }}
            ListFooterComponent={
              query.data ? <PageFooter query={query} /> : null
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { ...typography.title, fontFamily: fonts.bold, color: colors.ink },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceInset,
    alignItems: "center",
    justifyContent: "center",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  name: { ...typography.body, fontFamily: fonts.bold, color: colors.ink },
});
