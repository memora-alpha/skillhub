import type { ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "@/components/SafeArea";
import { useRouter } from "expo-router";
import { BrandLogo } from "@/components/BrandLogo";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { typography, colors, fonts, layout } from "@/constants/theme";
import { authCommunity } from "../mocks/auth";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const wide = width >= 1024;
  const logo = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="SkillHub — về màn chào"
      onPress={() => router.replace("/")}
    >
      <BrandLogo />
    </Pressable>
  );
  return (
    <SafeAreaView style={styles.screen}>
      {wide && (
        <View style={styles.aside}>
          {logo}
          <View style={styles.quoteGroup}>
            <View style={styles.accent} />
            <Text style={styles.quote}>
              {'"Chia sẻ điều bạn biết.\nHọc điều bạn muốn."'}
            </Text>
            <View style={styles.community}>
              <View style={styles.faces}>
                {authCommunity.map((person) => (
                  <View
                    key={person.initials}
                    style={[styles.face, { backgroundColor: person.color }]}
                  >
                    <Text style={styles.initials}>{person.initials}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.communityText}>
                +12.000 người dùng đang học
              </Text>
            </View>
          </View>
          <Text style={styles.copyright}>
            © 2024 SkillHub. Tất cả quyền được bảo lưu.
          </Text>
        </View>
      )}
      <KeyboardFormScrollView
        style={styles.keyboard}
        contentContainerStyle={[
          styles.scrollContent,
          Platform.OS === "web" && wide && { justifyContent: "center" },
          wide && { padding: 48 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          {!wide && <View style={styles.logo}>{logo}</View>}
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          {children}
        </View>
      </KeyboardFormScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: "row", backgroundColor: colors.cream },
  keyboard: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    padding: layout.gutter,
    paddingTop: 32,
    paddingBottom: 32,
  },
  form: { width: "100%", maxWidth: 448 },
  logo: { marginBottom: 24, alignSelf: "flex-start" },
  heading: { marginBottom: 24 },
  title: {
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.ink,
    includeFontPadding: false,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
    marginTop: 8,
    includeFontPadding: false,
  },
  aside: {
    width: 360,
    padding: 40,
    backgroundColor: colors.sageLight,
    justifyContent: "space-between",
  },
  quoteGroup: { gap: 24 },
  accent: {
    width: 64,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  quote: {
    fontFamily: fonts.semibold,
    fontSize: 22,
    lineHeight: 30,
    color: colors.ink,
    includeFontPadding: false,
  },
  community: { flexDirection: "row", alignItems: "center", gap: 12 },
  faces: { flexDirection: "row", paddingLeft: 8 },
  face: {
    width: 32,
    height: 32,
    marginLeft: -8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.sageLight,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.white,
    includeFontPadding: false,
  },
  communityText: {
    flexShrink: 1,
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.muted,
    includeFontPadding: false,
  },
  copyright: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.body,
    includeFontPadding: false,
  },
});
