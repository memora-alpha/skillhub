import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import type { OwnSkill } from "../types/skills";
import { hasPendingVerification } from "../utils/verification-state";
import { SkillAction } from "./SkillAction";
import { useEvidenceTransfer } from "../hooks/use-evidence-transfer";

export function SkillDetailActions({
  skill,
  pending,
  waiting: historyWaiting = false,
  onEdit,
  onVisibility,
  onVerify,
  onDelete,
}: Readonly<{
  skill: OwnSkill;
  pending: boolean;
  waiting?: boolean;
  onEdit: () => void;
  onVisibility: () => void;
  onVerify: () => void;
  onDelete: () => void;
}>) {
  const waiting = historyWaiting || hasPendingVerification(skill);
  const sending = useEvidenceTransfer(skill.id)?.state === "SENDING";
  if (skill.archivedAt) return null;
  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <Control
          icon="edit"
          label="Chỉnh sửa"
          disabled={pending}
          onPress={onEdit}
        />
        <Control
          icon={skill.isVisible ? "eye-off" : "eye"}
          label={skill.isVisible ? "Ẩn khỏi hồ sơ công khai" : "Hiện công khai"}
          disabled={pending}
          onPress={onVisibility}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Xóa kỹ năng"
        accessibilityState={{ disabled: pending || waiting }}
        disabled={pending || waiting}
        onPress={onDelete}
        style={({ pressed }) => [
          styles.archive,
          (pressed || pending || waiting) && styles.dim,
        ]}
      >
        <Icon name="trash" size={18} color={colors.error} />
        <Text style={styles.archiveLabel}>Xóa kỹ năng</Text>
      </Pressable>
      <View style={styles.verification}>
        {waiting ? (
          <Text style={styles.waiting}>Đang chờ xác minh</Text>
        ) : (
          <SkillAction
            label="Gửi bằng chứng xác minh"
            disabled={pending || sending}
            onPress={onVerify}
          />
        )}
      </View>
    </View>
  );
}
function Control({
  icon,
  label,
  disabled,
  onPress,
}: Readonly<{
  icon: IconName;
  label: string;
  disabled: boolean;
  onPress: () => void;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        (pressed || disabled) && styles.dim,
      ]}
    >
      <Icon name={icon} size={18} color={colors.ink} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  panel: { gap: 10 },
  verification: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 4,
  },
  waiting: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.warning,
  },
  row: { flexDirection: "row", gap: 10, alignItems: "stretch" },
  control: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    justifyContent: "center",
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  label: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.ink,
    textAlign: "center",
    flexShrink: 1,
  },
  archive: {
    flexDirection: "row",
    gap: 6,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.errorLight,
  },
  archiveLabel: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.error,
  },
  dim: { opacity: 0.55 },
});
