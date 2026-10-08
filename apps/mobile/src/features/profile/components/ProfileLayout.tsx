import { useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AccountMenu, AppHeader } from "@/features/shell";
import { InfoModal } from "@/components/InfoModal";
import { LogoutDialog } from "@/components/LogoutDialog";
import { useAuthSession, type AccountSession } from "@/features/auth";
import { demoNotifications, recentMessages } from "@/mocks/app";
import { signedInChrome } from "@/constants/theme";
import { appRoutes } from "@/constants/navigation";
import { profileStyles } from "./ProfilePrimitives";
import { profileDetails } from "../mocks/profile";

type ProfileLayoutProps = Readonly<{
  session: AccountSession;
  title?: string;
  onBack?: () => void;
  children: (open: (label: string) => void) => ReactNode;
}>;

function getProfileNoticeBody(notice: string | null, session: AccountSession) {
  switch (notice) {
    case "Thông tin riêng tư":
      return `${session.email}\n\nSố điện thoại và ngày sinh chưa có dữ liệu trong phiên demo. Thông tin không được gửi lên máy chủ.`;
    case "Ví Credit": {
      const balance = session.isNew ? 50 : 340;
      return `Số dư demo: ${balance} CR. Chức năng giao dịch chưa được kết nối.`;
    }
    case "Kỹ năng":
      return profileDetails.sharingSkills
        .map((skill) => `${skill.name} · ${skill.level}`)
        .join("\n");
    case "Thành tích": {
      const badges = profileDetails.badges
        .map((badge) => badge.label)
        .join(", ");
      return `Huy hiệu mẫu trong thiết kế: ${badges}. Chi tiết thành tích sẽ được triển khai sau.`;
    }
    default:
      return `Màn ${notice?.toLowerCase() ?? ""} sẽ được triển khai ở bước tiếp theo. Bạn đang xem hồ sơ với dữ liệu demo.`;
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
  return body;
}

export function ProfileLayout({
  session,
  title,
  onBack,
  children,
}: ProfileLayoutProps) {
  const router = useRouter();
  const { signOut } = useAuthSession();
  const [menu, setMenu] = useState(false);
  const [logout, setLogout] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const action = (label: string) => {
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
  const body = getProfileNoticeBody(notice, session);
  const edges = title
    ? (["top", "left", "right", "bottom"] as const)
    : (["top", "left", "right"] as const);
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      <AppHeader
        appearance="home"
        profile={session}
        title={title}
        onBack={onBack}
        onAction={action}
        onAccount={() => setMenu(true)}
      />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children(action)}
        </ScrollView>
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
  screen: { flex: 1, backgroundColor: signedInChrome.surface },
  keyboard: { flex: 1 },
  scroll: { flex: 1, backgroundColor: signedInChrome.background },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
  },
});
