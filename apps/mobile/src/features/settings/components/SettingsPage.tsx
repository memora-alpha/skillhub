import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { Href } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { appColors as colors } from "@/constants/theme";

export function SettingsPage({
  title,
  children,
  footer,
  back = "/account-settings",
}: Readonly<{
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  back?: Href;
}>) {
  return (
    <AppScreenLayout
      title={title}
      centeredTitle
      selected="Cài đặt"
      back={{
        href: back,
        label: back === "/profile" ? "Quay lại hồ sơ" : "Quay lại cài đặt",
      }}
    >
      {() => (
        <View style={styles.page}>
          <KeyboardFormScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
          >
            {children}
          </KeyboardFormScrollView>
          {footer && (
            <View style={styles.footer}>
              <View style={styles.footerContent}>{footer}</View>
            </View>
          )}
        </View>
      )}
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, minHeight: 0 },
  scroll: { flex: 1 },
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 24,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerContent: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
});
