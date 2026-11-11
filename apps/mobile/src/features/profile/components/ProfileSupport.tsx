import { StyleSheet, Text } from "react-native";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import {
  ProfileHeading,
  ProfileSection,
  profileStyles,
} from "./ProfilePrimitives";
import { profileColors } from "../constants/theme";

export function ProfileSupport({
  onOpen,
}: Readonly<{ onOpen: (label: string) => void }>) {
  return (
    <ProfileSection>
      <ProfileHeading title="Hỗ trợ" />
      <Button
        variant="ghost"
        accessibilityLabel="Báo cáo của tôi"
        style={styles.row}
        onPress={() => onOpen("Báo cáo của tôi")}
      >
        <Icon name="flag" size={18} color={profileColors.body} />
        <Text style={[profileStyles.label, styles.label]}>Báo cáo của tôi</Text>
        <Icon name="chevron" size={18} color={profileColors.muted} />
      </Button>
      <Button
        variant="ghost"
        accessibilityLabel="Trung tâm trợ giúp"
        style={[styles.row, styles.divider]}
        onPress={() => onOpen("Trung tâm trợ giúp")}
      >
        <Icon name="help" size={18} color={profileColors.body} />
        <Text style={[profileStyles.label, styles.label]}>
          Trung tâm trợ giúp
        </Text>
        <Icon name="chevron" size={18} color={profileColors.muted} />
      </Button>
    </ProfileSection>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    paddingHorizontal: 0,
    justifyContent: "flex-start",
    gap: 10,
  },
  label: { flex: 1, minWidth: 0, textAlign: "left" },
  divider: { borderTopWidth: 1, borderTopColor: profileColors.border },
});
