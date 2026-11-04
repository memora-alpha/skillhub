import { useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "@/components/SafeArea";
import { Redirect, useRouter, type Href } from "expo-router";
import { AccountMenu } from "./AccountMenu";
import { AppHeader } from "./AppHeader";
import { InfoModal } from "@/components/InfoModal";
import { appRoutes } from "@/constants/navigation";
import { typography, appColors as colors, fonts } from "@/constants/theme";
import { useAuthSession } from "@/features/auth";
import { LoadingScreenBoundary } from "@/components/LoadingScreenBoundary";
import { ScreenLoadingBoundary } from "@/components/ScreenLoadingBoundary";

type OpenNotice = (label: string) => void;
type AppScreenLayoutProps = Readonly<{
  title: string;
  titleContent?: ReactNode;
  centeredTitle?: boolean;
  selected: string;
  rightAction?: ReactNode | ((openNotice: OpenNotice) => ReactNode);
  back?: Readonly<{
    href: Href;
    label: string;
    behavior?: "destination" | "history";
    onPress?: () => void;
  }>;
  contentStyle?: StyleProp<ViewStyle>;
  navigationBlocked?: boolean;
  children: (openNotice: OpenNotice) => ReactNode;
}>;

function ScreenNoticeContent({
  notice,
}: Readonly<{
  notice: string | null;
}>) {
  return (
    <Text style={styles.body}>
      Nội dung {notice?.toLowerCase() ?? "này"} hiện chưa khả dụng.
    </Text>
  );
}

// The feature owns its scroll container (FlatList or ScrollView).
export function AppScreenLayout({
  title,
  titleContent,
  centeredTitle,
  selected,
  rightAction,
  back,
  contentStyle,
  navigationBlocked = false,
  children,
}: AppScreenLayoutProps) {
  const router = useRouter();
  const { session } = useAuthSession();
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  if (!session) return <Redirect href="/login" />;
  const action = (label: string) => {
    if (navigationBlocked) return;
    const route = appRoutes[label];
    if (route) {
      if (back && label === selected) router.dismissTo(route);
      else if (label !== selected) router.navigate(route);
      return;
    }
    setNotice(label);
  };
  const edges = back
    ? (["top", "left", "right", "bottom"] as const)
    : (["top", "left", "right"] as const);
  const handleBack = back
    ? (back.onPress ??
      (() => {
        if (back.behavior === "history" && router.canGoBack()) router.back();
        else router.dismissTo(back.href);
      }))
    : undefined;
  const headerAction =
    typeof rightAction === "function" ? rightAction(action) : rightAction;
  return (
    <LoadingScreenBoundary>
      <SafeAreaView edges={edges} style={styles.screen}>
        <AppHeader
          appearance="home"
          profile={session}
          title={title}
          titleContent={titleContent}
          centeredTitle={centeredTitle}
          onBack={handleBack}
          backLabel={back?.label}
          navigationBlocked={navigationBlocked}
          rightAction={headerAction}
          onAction={action}
          onAccount={() => {
            if (!navigationBlocked) setMenu(true);
          }}
        />
        <KeyboardAvoidingView
          style={[styles.content, contentStyle]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScreenLoadingBoundary>{children(action)}</ScreenLoadingBoundary>
        </KeyboardAvoidingView>
        <AccountMenu
          visible={menu}
          profile={session}
          onClose={() => setMenu(false)}
          onAction={action}
        />
        <InfoModal title={notice} onClose={() => setNotice(null)}>
          <ScreenNoticeContent notice={notice} />
        </InfoModal>
      </SafeAreaView>
    </LoadingScreenBoundary>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    width: "100%",
    backgroundColor: colors.canvas,
  },
  body: {
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.body,
  },
});
