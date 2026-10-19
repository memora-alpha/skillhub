import { StyleSheet, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius as radius,
  fonts,
} from "@/constants/theme";

export function HomeSearch({
  value,
  onChange,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <View style={styles.field}>
      <Icon name="search" color={colors.muted} size={18} />
      <TextInput
        accessibilityLabel="Tìm kỹ năng trong dữ liệu demo"
        value={value}
        onChangeText={onChange}
        placeholder="Tìm kỹ năng..."
        placeholderTextColor={colors.mutedLight}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLow,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    includeFontPadding: false,
  },
});
