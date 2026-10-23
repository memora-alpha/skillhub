import type { ReactNode } from "react";
import { Redirect, useRouter, type Href } from "expo-router";
import { SafeAreaView } from "@/components/SafeArea";
import { StyleSheet, View } from "react-native";
import { AppHeader } from "@/features/shell";
import { useAuthSession } from "@/features/auth";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import {
  appColors as colors,
  fonts,
  typography,
  radius,
} from "@/constants/theme";

export const skillStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: {
    padding: 16,
    gap: 16,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  card: {
    padding: 16,
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
  },
  heading: { fontFamily: fonts.bold, ...typography.heading, color: colors.ink },
  body: { fontFamily: fonts.body, ...typography.body, color: colors.body },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
});
export function SkillsLayout({
  title,
  children,
  scroll = true,
  locked,
  fallback = "/my-skills",
}: Readonly<{
  title: string;
  children: ReactNode;
  scroll?: boolean;
  locked?: () => boolean;
  fallback?: Href;
}>) {
  const { session } = useAuthSession();
  const router = useRouter();
  if (!session) return <Redirect href="/login" />;
  const navigate = (target: Href) => {
    if (!locked?.()) router.navigate(target);
  };
  return (
    <SafeAreaView
      style={skillStyles.screen}
      edges={["top", "bottom", "left", "right"]}
    >
      <AppHeader
        title={title}
        profile={session}
        onBack={() => {
          if (!locked?.()) {
            if (router.canGoBack()) router.back();
            else router.replace(fallback);
          }
        }}
        backLabel="Quay lại"
        onAccount={() => navigate("/profile")}
        onAction={(label) =>
          navigate(label === "Trang chủ" ? "/home" : "/profile")
        }
      />
      {scroll ? (
        <KeyboardFormScrollView contentContainerStyle={skillStyles.content}>
          {children}
        </KeyboardFormScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </SafeAreaView>
  );
}
