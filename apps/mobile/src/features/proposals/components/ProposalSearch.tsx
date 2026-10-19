import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appColors as colors, fonts, typography } from "@/constants/theme";

export function ProposalSearchButton({
  expanded,
  onPress,
}: Readonly<{
  expanded: boolean;
  onPress: () => void;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        expanded ? "Đóng tìm kiếm đề xuất" : "Tìm kiếm đề xuất"
      }
      accessibilityState={{ expanded }}
      aria-expanded={expanded}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Icon
        name="search"
        size={20}
        color={expanded ? colors.primary : colors.muted}
      />
    </Pressable>
  );
}

export function ProposalSearchField({
  value,
  onChange,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <View style={styles.search}>
      <View style={styles.field}>
        <Icon name="search" size={18} color={colors.muted} />
        <TextInput
          autoFocus
          accessibilityLabel="Tìm nội dung đề xuất đã tải"
          placeholder="Tìm nội dung đề xuất..."
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={onChange}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={120}
          returnKeyType="search"
          style={styles.input}
        />
        {!!value && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xóa từ khóa tìm đề xuất"
            onPress={() => onChange("")}
            style={styles.iconButton}
          >
            <Icon name="close" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>
      <Text style={styles.caption}>Tìm trong các đề xuất đã tải.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.65 },
  search: { gap: 4, paddingTop: 12 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.ink,
  },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
});
