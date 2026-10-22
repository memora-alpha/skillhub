import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { sessionUi as styles } from "./session-page.styles";

export function SessionPage({
  title,
  back = "/calendar",
  backBehavior = "destination",
  demo = false,
  children,
}: Readonly<{
  title: string;
  back?: Href;
  backBehavior?: "destination" | "history";
  demo?: boolean;
  children: ReactNode;
}>) {
  return (
    <AppScreenLayout
      title={title}
      selected="Lịch học"
      back={{ href: back, label: "Quay lại", behavior: backBehavior }}
      contentStyle={styles.background}
    >
      {() => (
        <KeyboardFormScrollView contentContainerStyle={styles.page}>
          {demo && (
            <Text style={styles.preview}>BẢN XEM THỬ · DỮ LIỆU MẪU</Text>
          )}
          {children}
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
export function SessionPanel({
  title,
  accent = false,
  children,
}: Readonly<{
  title?: string;
  accent?: boolean;
  children: ReactNode;
}>) {
  return (
    <View style={[styles.panel, accent && styles.accent]}>
      {title && (
        <Text accessibilityRole="header" style={styles.heading}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}
export function SessionCopy({
  children,
  muted = false,
}: Readonly<{
  children: ReactNode;
  muted?: boolean;
}>) {
  return (
    <Text selectable style={muted ? styles.secondary : styles.body}>
      {children}
    </Text>
  );
}
export function SessionButton({
  children,
  variant = "craft",
  disabled = false,
  onPress,
}: Readonly<{
  children: string;
  variant?: "craft" | "paper" | "ghost";
  disabled?: boolean;
  onPress: () => void;
}>) {
  return (
    <Button
      accessibilityLabel={children}
      variant={variant}
      disabled={disabled}
      onPress={onPress}
      style={styles.action}
    >
      <Text
        style={[
          styles.actionLabel,
          variant !== "craft" && styles.secondaryActionLabel,
        ]}
      >
        {children}
      </Text>
    </Button>
  );
}
export function SessionRouteButton({
  href,
  children,
  secondary = false,
}: Readonly<{
  href: Href;
  children: string;
  secondary?: boolean;
}>) {
  const router = useRouter();
  return (
    <SessionButton
      variant={secondary ? "paper" : "craft"}
      onPress={() => router.push(href)}
    >
      {children}
    </SessionButton>
  );
}
export function SessionEmptyState(
  props: Readonly<Parameters<typeof EmptyState>[0]>,
) {
  return (
    <EmptyState {...props} titleStyle={[styles.heading, props.titleStyle]} />
  );
}
