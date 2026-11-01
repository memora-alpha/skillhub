import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { LogoutDialog } from "@/components/LogoutDialog";
import { useAuthSession } from "@/features/auth";
import { appColors, fonts, typography } from "@/constants/theme";
import { profileColors } from "../constants/theme";

export function ProfileLogout() {
  const { signOut } = useAuthSession();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.footer}>
      <Button
        variant="ghost"
        accessibilityLabel="Đăng xuất"
        style={styles.button}
        onPress={() => setVisible(true)}
      >
        <Icon name="logout" size={20} color={appColors.error} />
        <Text style={styles.label}>Đăng xuất</Text>
      </Button>
      <LogoutDialog
        visible={visible}
        onClose={() => setVisible(false)}
        onConfirm={() => {
          setVisible(false);
          void signOut();
          router.replace("/login");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 8,
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderColor: profileColors.border,
  },
  button: {
    width: "100%",
    minHeight: 48,
    borderWidth: 1,
    borderColor: appColors.error,
    backgroundColor: appColors.errorLight,
  },
  label: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: appColors.error,
    includeFontPadding: false,
  },
});
