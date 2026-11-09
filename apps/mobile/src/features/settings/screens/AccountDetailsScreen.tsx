import { StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { Badge } from "@/components/Badge";
import { ActionRow } from "@/components/ActionGroup";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import { useAuthSession } from "@/features/auth";
import { SettingsPage } from "../components/SettingsPage";
import {
  SettingsIntro,
  SettingsSection,
  SettingsNote,
  settingsStyles,
} from "../components/SettingsUI";

const accountStatuses = {
  ACTIVE: { label: "Đang hoạt động", variant: "success" },
  PENDING_VERIFICATION: { label: "Chờ xác minh", variant: "warning" },
  LOCKED: { label: "Đã khóa", variant: "warning" },
  SUSPENDED: { label: "Tạm đình chỉ", variant: "warning" },
  DEACTIVATED: { label: "Đã vô hiệu hóa", variant: "default" },
} as const;

export function AccountDetailsScreen() {
  const { session, account } = useAuthSession();
  const router = useRouter();
  if (!session || !account) return <Redirect href="/login" />;
  const status = accountStatuses[account.accountStatus];
  return (
    <SettingsPage title="Tài khoản">
      <SettingsIntro
        title="Thông tin đăng nhập"
        description="Email và trạng thái xác minh của tài khoản SkillHub."
      />
      <SettingsSection title="Email đăng nhập">
        <View style={styles.emailCard}>
          <View style={styles.emailHeading}>
            <Text style={styles.monogram}>@</Text>
            <Text style={settingsStyles.label}>Địa chỉ email của bạn</Text>
          </View>
          <Text selectable style={styles.email}>
            {account.email}
          </Text>
          <Text style={settingsStyles.caption}>
            Dùng để đăng nhập và nhận mã xác minh.
          </Text>
        </View>
      </SettingsSection>
      <SettingsSection title="Trạng thái tài khoản">
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Xác minh email</Text>
          <Badge
            label={account.emailVerified ? "Đã xác minh" : "Chưa xác minh"}
            variant={account.emailVerified ? "success" : "warning"}
          />
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Tài khoản</Text>
          <Badge label={status.label} variant={status.variant} />
        </View>
      </SettingsSection>
      <SettingsSection title="Bảo mật">
        <ActionRow
          icon="lock"
          label="Đặt lại mật khẩu"
          description="Xác minh email trước khi đổi mật khẩu"
          onPress={() => router.push("/forgot-password")}
        />
      </SettingsSection>
      <SettingsNote>
        Email đăng nhập chỉ hiển thị với bạn và không xuất hiện trên hồ sơ công
        khai.
      </SettingsNote>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  emailCard: { padding: 20, gap: 12 },
  emailHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  monogram: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: appRadius.control,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  email: {
    ...typography.heading,
    fontFamily: fonts.bold,
    color: colors.ink,
    flexShrink: 1,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 18,
    minHeight: 66,
  },
  statusLabel: {
    ...typography.body,
    fontFamily: fonts.medium,
    color: colors.inkSoft,
    flexShrink: 1,
  },
});
