import {
  useCallback,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { Text, View, StyleSheet } from "react-native";
import { FeaturePage } from "./feature-page";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export function FlowPage(props: ComponentProps<typeof FeaturePage>) {
  return <FeaturePage {...props} section="Tin nhắn" demo={false} />;
}
// Legacy aliases return to an existing destination instead of cloning it.
export function FlowRedirect({ href }: Readonly<{ href: Href }>) {
  const router = useRouter(),
    destination = useRef(href);
  destination.current = href;
  useFocusEffect(
    useCallback(() => {
      router.dismissTo(destination.current);
    }, [router]),
  );
  return null;
}
export function FlowSection({
  title,
  children,
  accent = false,
  compact = false,
}: Readonly<{
  title?: string;
  children: ReactNode;
  accent?: boolean;
  compact?: boolean;
}>) {
  return (
    <View
      style={[
        styles.section,
        compact && styles.compact,
        accent && styles.accent,
      ]}
    >
      {title && (
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  compact: { padding: 12, gap: 8 },
  section: {
    padding: 16,
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
  },
  accent: { backgroundColor: colors.forestSoft },
  title: { ...typography.heading, fontFamily: fonts.bold, color: colors.ink },
});
