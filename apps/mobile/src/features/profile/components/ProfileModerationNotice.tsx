import { StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "@/features/auth";
import { Icon } from "@/components/Icon";
import { appColors, fonts, typography } from "@/constants/theme";
import { ProfileButton } from "./ProfileButton";
import { ProfileSection, profileStyles } from "./ProfilePrimitives";

export function ProfileModerationNotice({
  onEdit,
  disabled = false,
}: Readonly<{
  onEdit?: () => void;
  disabled?: boolean;
}>) {
  const { account } = useAuthSession();
  const moderation = account?.profile.profileModeration;
  const fields = [
    { key: "bio", label: "Giới thiệu", entry: moderation?.bio },
    { key: "avatar", label: "Ảnh đại diện", entry: moderation?.avatar },
  ].filter((field) => field.entry);
  if (!fields.length) return null;
  return (
    <ProfileSection style={styles.notice}>
      <View style={styles.heading}>
        <Icon name="shield" size={20} color={appColors.warning} />
        <Text
          accessibilityRole="header"
          style={[profileStyles.heading, styles.title]}
        >
          Hồ sơ cần được cập nhật
        </Text>
      </View>
      {fields.map(
        ({ key, label, entry }) =>
          entry && (
            <View key={key} style={styles.field}>
              <Text style={styles.fieldTitle}>
                {label}
                {entry.action === "HIDE" ? " đã bị ẩn" : " cần chỉnh sửa"}
              </Text>
              <Text selectable style={profileStyles.body}>
                Lý do: {entry.reason}
              </Text>
              <Text selectable style={styles.timestamp}>
                Cập nhật{" "}
                {new Intl.DateTimeFormat("vi-VN", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date(entry.at))}
              </Text>
            </View>
          ),
      )}
      {onEdit && (
        <ProfileButton variant="secondary" disabled={disabled} onPress={onEdit}>
          Chỉnh sửa hồ sơ
        </ProfileButton>
      )}
    </ProfileSection>
  );
}

const styles = StyleSheet.create({
  notice: {
    gap: 14,
    borderColor: appColors.amber,
    backgroundColor: appColors.amberSoft,
  },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: { flex: 1 },
  field: { gap: 5 },
  fieldTitle: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: appColors.ink,
  },
  timestamp: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: appColors.inkSoft,
  },
});
