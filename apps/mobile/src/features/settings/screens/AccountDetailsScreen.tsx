import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { Badge } from "@/components/Badge";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius as radius,
  fonts,
  typography,
} from "@/constants/theme";
import { useAuthSession } from "@/features/auth";

const accountStatuses = {
  ACTIVE: { label: "Đang hoạt động", variant: "success" },
  PENDING_VERIFICATION: { label: "Chờ xác minh", variant: "warning" },
  LOCKED: { label: "Đã khóa", variant: "warning" },
  SUSPENDED: { label: "Tạm đình chỉ", variant: "warning" },
  DEACTIVATED: { label: "Đã vô hiệu hóa", variant: "default" },
} as const;

export function AccountDetailsScreen() {
  const { session, account } = useAuthSession();
  if (!session || !account) return <Redirect href="/login" />;
  const status = accountStatuses[account.accountStatus];
  return (
    <AppScreenLayout
      title="Tài khoản"
      selected="Cài đặt"
      back={{ href: "/account-settings", label: "Quay lại cài đặt" }}
    >
      {() => (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <Icon name="lock" size={24} color={colors.primary} />
            </View>
            <View style={styles.introCopy}>
              <Text accessibilityRole="header" style={styles.title}>
                Thông tin đăng nhập
              </Text>
              <Text style={styles.caption}>
                Email và trạng thái tài khoản của bạn.
              </Text>
            </View>
          </View>
          <View style={[styles.card, styles.emailCard]}>
            <Text style={styles.label}>Email đăng nhập</Text>
            <Text selectable style={styles.email}>
              {account.email}
            </Text>
            <Text style={styles.caption}>
              Dùng để đăng nhập và nhận mã xác minh.
            </Text>
          </View>
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Trạng thái
            </Text>
            <View style={styles.card}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Xác minh email</Text>
                <Badge
                  label={
                    account.emailVerified ? "Đã xác minh" : "Chưa xác minh"
                  }
                  variant={account.emailVerified ? "success" : "warning"}
                />
              </View>
              <View style={[styles.statusRow, styles.separator]}>
                <Text style={styles.statusLabel}>Trạng thái tài khoản</Text>
                <Badge label={status.label} variant={status.variant} />
              </View>
            </View>
          </View>
          <View style={styles.privacy}>
            <Icon name="shield" size={18} color={colors.muted} />
            <Text style={styles.privacyText}>
              Chỉ bạn xem được thông tin này. Email đăng nhập không hiển thị
              trên hồ sơ công khai.
            </Text>
          </View>
        </ScrollView>
      )}
    </AppScreenLayout>
  );
}
const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 24,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  intro: { flexDirection: "row", alignItems: "center", gap: 12 },
  introIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  introCopy: { flex: 1, minWidth: 0, gap: 4 },
  title: { ...typography.title, fontFamily: fonts.bold, color: colors.ink },
  section: { gap: 8 },
  sectionTitle: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.inkSoft,
    paddingHorizontal: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  emailCard: { padding: 18, gap: 8 },
  label: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.inkSoft,
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
    minHeight: 64,
    padding: 16,
  },
  statusLabel: {
    ...typography.body,
    fontFamily: fonts.medium,
    color: colors.body,
    flex: 1,
    minWidth: 120,
  },
  separator: { borderTopWidth: 1, borderTopColor: colors.border },
  caption: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.inkSoft,
  },
  privacy: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  privacyText: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    flex: 1,
  },
});
