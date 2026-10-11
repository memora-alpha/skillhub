import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import type { EvidenceSource } from "../utils/pick-evidence";

export function EvidencePicker({
  disabled,
  picking,
  onPick,
}: {
  disabled: boolean;
  picking: boolean;
  onPick: (source: EvidenceSource) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.row}>
        <Choice
          icon="image"
          label="Chọn ảnh"
          hint="Thư viện ảnh"
          disabled={disabled}
          onPress={() => onPick("photos")}
        />
        <Choice
          icon="paperclip"
          label="Chọn file"
          hint="PDF, Word"
          disabled={disabled}
          onPress={() => onPick("files")}
        />
      </View>
      <Text style={styles.caption}>
        {picking ? "Đang chọn…" : "Tối đa 5 file · 10 MB/file"}
      </Text>
    </View>
  );
}

function Choice({
  icon,
  label,
  hint,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        (pressed || disabled) && styles.dim,
      ]}
    >
      <Icon name={icon} size={18} color={colors.primaryDark} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  row: { flexDirection: "row", gap: 10 },
  choice: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.ink,
    textAlign: "center",
    flexShrink: 1,
  },
  caption: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.muted,
    textAlign: "center",
  },
  dim: { opacity: 0.55 },
});
