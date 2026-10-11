import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import Constants from "expo-constants";
import { ActionGroup, ActionRow } from "@/components/ActionGroup";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { InfoModal } from "@/components/InfoModal";
import { LogoutDialog } from "@/components/LogoutDialog";
import { AppScreenLayout } from "@/features/shell";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import { useAuthSession, useAuthActions } from "@/features/auth";
import { settingsInformation } from "../components/SettingsInformation";

type SettingsNotice = keyof typeof settingsInformation;
export function AccountSettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useAuthSession();
  const { logoutAll } = useAuthActions();
  const [notice, setNotice] = useState<SettingsNotice | null>(null);
  const [logout, setLogout] = useState(false);
  if (!session) return <Redirect href="/login" />;
  const busy = logoutAll.isPending;
  const information = notice ? settingsInformation[notice] : null;
  const closeNotice = () => {
    if (!busy) setNotice(null);
  };
  return (
    <AppScreenLayout
      title="Cài đặt"
      selected="Cài đặt"
      back={{ href: "/profile", label: "Quay lại hồ sơ" }}
    >
      {() => (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <ActionGroup title="Tài khoản và bảo mật">
              <ActionRow
                icon="user"
                label="Tài khoản"
                description="Email đăng nhập và trạng thái xác minh"
                disabled={busy}
                onPress={() => router.push("/account-details")}
              />
              <ActionRow
                icon="lock"
                label="Đặt lại mật khẩu"
                description="Xác minh qua email để tạo mật khẩu mới"
                disabled={busy}
                onPress={() => router.push("/forgot-password")}
              />
              <ActionRow
                icon="shield"
                label="Đăng xuất tất cả thiết bị"
                description="Kết thúc các phiên đăng nhập đang hoạt động"
                disabled={busy}
                onPress={() => setNotice("sessions")}
              />
            </ActionGroup>
            <ActionGroup title="Tùy chọn ứng dụng">
              <ActionRow
                icon="clock"
                label="Múi giờ"
                description="Xem lựa chọn và đồng hồ mẫu"
                onPress={() => router.push("/preferences/timezone")}
              />
              <ActionRow
                icon="book"
                label="Ngôn ngữ"
                description="Tiếng Việt / English · bản xem thử"
                onPress={() => router.push("/preferences/language")}
              />
              <ActionRow
                icon="bell"
                label="Thông báo"
                description="Tùy chỉnh nhóm thông báo trong bản xem thử"
                onPress={() => router.push("/preferences/notifications")}
              />
              <ActionRow
                icon="shield"
                label="Quyền riêng tư"
                description="Thông tin công khai và riêng tư"
                onPress={() => router.push("/preferences/privacy")}
              />
            </ActionGroup>
            <ActionGroup title="Thông tin và hỗ trợ">
              <ActionRow
                icon="help"
                label="Trợ giúp"
                description="Hồ sơ, ảnh đại diện và bảo mật"
                disabled={busy}
                onPress={() => router.push("/help")}
              />
              <ActionRow
                icon="compass"
                label="Giới thiệu SkillHub"
                description="Thông tin ứng dụng và phiên bản"
                disabled={busy}
                onPress={() => setNotice("about")}
              />
            </ActionGroup>
            <View style={styles.footer}>
              <Button
                variant="ghost"
                style={styles.logoutButton}
                accessibilityLabel="Đăng xuất"
                disabled={busy}
                onPress={() => setLogout(true)}
              >
                <Icon name="logout" size={20} color={colors.error} />
                <Text style={styles.logoutLabel}>Đăng xuất</Text>
              </Button>
              <Text style={styles.version}>
                SkillHub {Constants.expoConfig?.version ?? ""}
              </Text>
            </View>
          </ScrollView>
          <InfoModal
            title={information?.title ?? null}
            onClose={closeNotice}
            confirmLabel={
              notice === "sessions"
                ? busy
                  ? "Đang đăng xuất..."
                  : "Đăng xuất tất cả"
                : "Đã hiểu"
            }
            onConfirm={
              notice === "sessions"
                ? () => {
                    if (!busy) logoutAll.mutate();
                  }
                : closeNotice
            }
          >
            {information?.body}
          </InfoModal>
          <LogoutDialog
            visible={logout}
            onClose={() => setLogout(false)}
            onConfirm={() => {
              setLogout(false);
              void signOut();
              router.replace("/login");
            }}
          />
        </>
      )}
    </AppScreenLayout>
  );
}
const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 24,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  footer: { alignItems: "center", gap: 8, paddingBottom: 8 },
  logoutButton: {
    width: "100%",
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  logoutLabel: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: colors.error,
    includeFontPadding: false,
  },
  version: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.inkSoft,
  },
});
