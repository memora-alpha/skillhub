import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import Constants from "expo-constants";
import { ActionRow } from "@/components/ActionGroup";
import { InfoModal } from "@/components/InfoModal";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import { useAuthSession, useAuthActions } from "@/features/auth";
import { settingsInformation } from "../components/SettingsInformation";
import { SettingsPage } from "../components/SettingsPage";
import { SettingsSection, SettingsNote } from "../components/SettingsUI";
import { SettingsAccountCard } from "../components/SettingsAccountCard";
import { timezoneLabel } from "../utils/preferences";

type SettingsNotice = keyof typeof settingsInformation;
export function AccountSettingsScreen() {
  const router = useRouter();
  const { session, account } = useAuthSession();
  const { logoutAll } = useAuthActions();
  const [notice, setNotice] = useState<SettingsNotice | null>(null);
  if (!session) return <Redirect href="/login" />;
  const busy = logoutAll.isPending;
  const information = notice ? settingsInformation[notice] : null;
  const closeNotice = () => {
    if (!busy) setNotice(null);
  };
  return (
    <SettingsPage title="Cài đặt" back="/profile">
      <>
        <SettingsAccountCard
          session={session}
          disabled={busy}
          onPress={() => router.push("/account-details")}
        />
        <SettingsSection title="Tài khoản & bảo mật">
          <ActionRow
            icon="lock"
            label="Đặt lại mật khẩu"
            description="Bảo vệ tài khoản bằng mật khẩu mới"
            disabled={busy}
            onPress={() => router.push("/forgot-password")}
          />
          <ActionRow
            icon="logout"
            label="Đăng xuất tất cả thiết bị"
            description="Kết thúc các phiên đăng nhập đang hoạt động"
            disabled={busy}
            destructive
            onPress={() => setNotice("sessions")}
          />
        </SettingsSection>
        <SettingsSection title="Trải nghiệm ứng dụng">
          <ActionRow
            icon="clock"
            label="Múi giờ"
            description={
              account?.profile.timezone
                ? timezoneLabel(account.profile.timezone)
                : "Chưa chọn múi giờ"
            }
            disabled={busy}
            onPress={() => router.push("/preferences/timezone")}
          />
          <ActionRow
            icon="book"
            label="Ngôn ngữ"
            description={
              account?.profile.locale === "en" ? "English" : "Tiếng Việt"
            }
            disabled={busy}
            onPress={() => router.push("/preferences/language")}
          />
          <ActionRow
            icon="bell"
            label="Thông báo"
            description="Chọn nhóm Học tập, Credit và Cộng đồng"
            disabled={busy}
            onPress={() => router.push("/preferences/notifications")}
          />
          <ActionRow
            icon="shield"
            label="Quyền riêng tư"
            description="Thông tin công khai và riêng tư"
            disabled={busy}
            onPress={() => router.push("/preferences/privacy")}
          />
        </SettingsSection>
        <SettingsSection title="Thông tin & hỗ trợ">
          <ActionRow
            icon="shield"
            label="Chính sách & điều khoản"
            description="Nguyên tắc sử dụng và bảo vệ dữ liệu"
            disabled={busy}
            onPress={() => router.push("/policies")}
          />
          <ActionRow
            icon="help"
            label="Trợ giúp"
            description="Câu hỏi thường gặp và hướng dẫn"
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
        </SettingsSection>
        <SettingsNote>
          Thông tin đăng nhập và tùy chọn tài khoản chỉ hiển thị với bạn.
        </SettingsNote>
        <View style={styles.footer}>
          <Text style={styles.version}>
            SkillHub {Constants.expoConfig?.version ?? ""}
          </Text>
        </View>
        <InfoModal
          title={information?.title ?? null}
          onClose={closeNotice}
          busy={busy}
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
      </>
    </SettingsPage>
  );
}
const styles = StyleSheet.create({
  footer: { alignItems: "center", gap: 8, paddingBottom: 8 },
  version: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.inkSoft,
  },
});
