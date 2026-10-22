import { RefreshableScrollView as ScrollView } from "@/components/RefreshableScrollView";
import { useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AccountMenu, AppHeader } from "@/features/shell";
import { InfoModal } from "@/components/InfoModal";
import { LogoutDialog } from "@/components/LogoutDialog";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { useAuthSession, type AccountSession } from "@/features/auth";
import { demoNotifications, recentMessages } from "@/mocks/app";
import { appRoutes } from "@/constants/navigation";
import { profileStyles } from "./ProfilePrimitives";
import { profileColors } from "../constants/theme";
import { useProfilePreview } from "../context/ProfilePreview";
import type { PublicProfile } from "../types/profile";

type ProfileLayoutProps = Readonly<{
  session: AccountSession;
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  keyboardAware?: boolean;
  children: (open: (label: string) => void) => ReactNode;
}>;

function getProfileNoticeBody(
  notice: string | null,
  profile: PublicProfile | null,
) {
  switch (notice) {
    case "Ví Credit":
      return "Chức năng ví và giao dịch Credit chưa được kết nối.";
    case "Kỹ năng":
      return profile?.sharingSkills.length
        ? "Quản lý kỹ năng sẽ được bổ sung sau."
        : "Danh sách kỹ năng chưa được kết nối.";
    case "Đánh giá về tôi":
      return "Đánh giá từ người học cùng chưa được kết nối.";
    default:
      return `Màn ${notice?.toLowerCase() ?? ""} sẽ được triển khai ở bước tiếp theo.`;
  }
}

function ProfileNoticeContent({
  notice,
  body,
}: Readonly<{ notice: string | null; body: string }>) {
  if (notice === "Thông báo") {
    return (
      <View style={{ gap: 12 }}>
        {demoNotifications.map((item) => (
          <Text key={item} style={profileStyles.body}>
            {item}
          </Text>
        ))}
      </View>
    );
  }
  if (notice === "Tin nhắn") {
    return (
      <View style={{ gap: 12 }}>
        {recentMessages.map((item) => (
          <View key={item.id}>
            <Text style={profileStyles.label}>{item.name}</Text>
            <Text style={profileStyles.caption}>{item.message}</Text>
          </View>
        ))}
      </View>
    );
  }
  return <Text style={profileStyles.body}>{body}</Text>;
}

export function ProfileLayout({
  session,
  title,
  onBack,
  backLabel,
  keyboardAware = false,
  children,
}: ProfileLayoutProps) {
  const router = useRouter();
  const { signOut } = useAuthSession();
  const { profile } = useProfilePreview();
  const [menu, setMenu] = useState(false);
  const [logout, setLogout] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const action = (label: string) => {
    if (label === "Kỹ năng") return router.push("/my-skills");
    if (label === "Trang chủ") {
      if (title) router.dismissTo("/home");
      else router.navigate("/home");
      return;
    }
    if (label === "Hồ sơ") {
      if (title) router.dismissTo("/profile");
      return;
    }
    const route = appRoutes[label];
    if (route) return router.navigate(route);
    setNotice(label);
  };
  const body = getProfileNoticeBody(notice, profile);
  const ScrollContainer = keyboardAware ? KeyboardFormScrollView : ScrollView;
  const edges = title
    ? (["top", "left", "right", "bottom"] as const)
    : (["top", "left", "right"] as const);
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <AppHeader
        appearance="home"
        chromeColors={{
          background: profileColors.background,
          border: profileColors.border,
          accent: profileColors.accent,
        }}
        profile={session}
        title={title ?? "Hồ sơ"}
        onBack={onBack}
        backLabel={backLabel}
        onAction={action}
        onAccount={() => setMenu(true)}
      />
      <KeyboardAvoidingView
        enabled={!keyboardAware}
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollContainer
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            keyboardAware && Platform.OS === "ios" ? "interactive" : "on-drag"
          }
        >
          {children(action)}
        </ScrollContainer>
      </KeyboardAvoidingView>
      <AccountMenu
        visible={menu}
        profile={session}
        onClose={() => setMenu(false)}
        onAction={action}
        onLogout={() => {
          setMenu(false);
          setLogout(true);
        }}
      />
      <InfoModal title={notice} onClose={() => setNotice(null)}>
        <ProfileNoticeContent notice={notice} body={body} />
      </InfoModal>
      <LogoutDialog
        visible={logout}
        onClose={() => setLogout(false)}
        onConfirm={() => {
          setLogout(false);
          void signOut();
          router.replace("/");
        }}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: profileColors.surface },
  keyboard: { flex: 1 },
  scroll: { flex: 1, backgroundColor: profileColors.background },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
  },
});
