import { Redirect, useLocalSearchParams } from "expo-router";
import { useAuthSession } from "@/features/auth";
import { Text } from "react-native";
import { SettingsPage } from "../components/SettingsPage";
import { settingsStyles } from "../components/SettingsUI";
import { LocaleSettingsScreen } from "./LocaleSettingsScreen";
import { NotificationSettingsScreen } from "./NotificationSettingsScreen";
import { PrivacySettingsScreen } from "./PrivacySettingsScreen";

export function PreferencesScreen() {
  const { section } = useLocalSearchParams<{ section?: string | string[] }>();
  const { account, runtime } = useAuthSession();
  if (!account) return <Redirect href="/login" />;
  const key = `${runtime.controller.generation}:${section}`;
  if (section === "timezone" || section === "language")
    return (
      <LocaleSettingsScreen
        key={key}
        section={section}
        profile={account.profile}
      />
    );
  if (section === "notifications")
    return <NotificationSettingsScreen key={key} />;
  if (section === "privacy")
    return <PrivacySettingsScreen userId={account.userId} />;
  return (
    <SettingsPage title="Tùy chọn">
      <Text style={settingsStyles.body}>Không tìm thấy mục cài đặt này.</Text>
    </SettingsPage>
  );
}
