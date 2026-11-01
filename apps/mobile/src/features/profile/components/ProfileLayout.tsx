import { RefreshableScrollView as ScrollView } from "@/components/RefreshableScrollView";
import { useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "@/components/SafeArea";
import { useRouter } from "expo-router";
import { AccountMenu, AppHeader } from "@/features/shell";
import { InfoModal } from "@/components/InfoModal";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import type { AccountSession } from "@/features/auth";
import { appRoutes } from "@/constants/navigation";
import { profileStyles } from "./ProfilePrimitives";
import { profileColors } from "../constants/theme";
import { ScreenLoadingBoundary } from "@/components/ScreenLoadingBoundary";

type ProfileLayoutProps = Readonly<{
  session: AccountSession;
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  keyboardAware?: boolean;
  children: (open: (label: string) => void) => ReactNode;
}>;

function ProfileNoticeContent({ body }: Readonly<{ body: string }>) {
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
  const [menu, setMenu] = useState(false);
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
  const body = `Nội dung ${notice?.toLowerCase() ?? "này"} hiện chưa khả dụng.`;
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
        <ScreenLoadingBoundary>
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
        </ScreenLoadingBoundary>
      </KeyboardAvoidingView>
      <AccountMenu
        visible={menu}
        profile={session}
        onClose={() => setMenu(false)}
        onAction={action}
      />
      <InfoModal title={notice} onClose={() => setNotice(null)}>
        <ProfileNoticeContent body={body} />
      </InfoModal>
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
