import type { ReactNode } from "react";
import { StyleSheet, Text, View, type ScrollViewProps } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "./KeyboardFormScrollView";
import { Button } from "./Button";
import { appColors as colors, appRadius, fonts } from "@/constants/theme";

export function FeaturePage({
  title,
  subtitle,
  children,
  back = "/ui",
  backBehavior = "destination",
  demo = true,
  keyboardDismissMode,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  back?: Href;
  backBehavior?: "destination" | "history";
  demo?: boolean;
  keyboardDismissMode?: ScrollViewProps["keyboardDismissMode"];
}) {
  return (
    <AppScreenLayout
      title={title}
      selected="Hồ sơ"
      back={{ href: back, label: "Quay lại", behavior: backBehavior }}
    >
      {() => (
        <KeyboardFormScrollView
          contentContainerStyle={ui.page}
          {...(keyboardDismissMode ? { keyboardDismissMode } : {})}
        >
          {demo && <Text style={ui.demo}>BẢN XEM THỬ · DỮ LIỆU MẪU</Text>}
          {subtitle && <Text style={ui.subtitle}>{subtitle}</Text>}
          {children}
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
export function Panel({
  title,
  children,
  accent = false,
}: {
  title?: string;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <View style={[ui.panel, accent && ui.accent]}>
      {title && (
        <Text accessibilityRole="header" style={ui.heading}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}
export function Copy({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <Text selectable style={[ui.copy, muted && { color: colors.muted }]}>
      {children}
    </Text>
  );
}
export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={ui.metric}>
      <Text style={ui.label}>{label}</Text>
      <Text selectable style={ui.number}>
        {value}
      </Text>
    </View>
  );
}
export function RouteButton({
  href,
  children,
  secondary = false,
}: {
  href: Href;
  children: string;
  secondary?: boolean;
}) {
  const router = useRouter();
  return (
    <Button
      variant={secondary ? "paper" : "craft"}
      onPress={() => router.push(href)}
    >
      {children}
    </Button>
  );
}
export const ui = StyleSheet.create({
  page: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 36,
    gap: 16,
  },
  demo: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 1,
    color: colors.primary,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 24,
    color: colors.body,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: appRadius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 12,
  },
  accent: {
    backgroundColor: colors.forestSoft,
    borderColor: colors.forestMuted,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 30,
    color: colors.ink,
  },
  copy: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 24,
    color: colors.body,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
  },
  number: {
    fontFamily: fonts.displayBold,
    fontSize: 32,
    lineHeight: 42,
    color: colors.forest,
    fontVariant: ["tabular-nums"],
  },
  metric: { flex: 1, minWidth: 110, gap: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  grow: { flex: 1, minWidth: 0 },
});
