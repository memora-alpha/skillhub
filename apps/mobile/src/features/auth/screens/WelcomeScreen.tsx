import { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandLogo } from "@/components/BrandLogo";
import { useRouter } from "expo-router";
import { colors, fonts, layout } from "@/constants/theme";
import { WelcomeNotice } from "../components/WelcomeNotice";
import { WelcomeHero } from "../components/WelcomeHero";
import { WelcomeSections } from "../components/WelcomeSections";

export function WelcomeScreen() {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const sections = useRef({ how: 0, categories: 0, credit: 0 });
  const { width } = useWindowDimensions();
  const scrollTo = (section: keyof typeof sections.current) =>
    scroll.current?.scrollTo({ y: sections.current[section], animated: true });
  const openAuth = (destination: "Đăng nhập" | "Đăng ký") => {
    router.push(destination === "Đăng nhập" ? "/login" : "/register");
  };
  const onLink = (label: string) => {
    if (label === "Khám phá kỹ năng" || label === "Xem tất cả")
      return scrollTo("categories");
    if (label === "Cách hoạt động") return scrollTo("how");
    if (label === "Credit") return scrollTo("credit");
    setNotice(label);
  };
  const onSectionLayout = (
    section: keyof typeof sections.current,
    event: LayoutChangeEvent,
  ) => {
    sections.current[section] = event.nativeEvent.layout.y;
  };
  return (
    <SafeAreaView
      style={styles.screen}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={styles.headerBorder}>
        <View style={[styles.header, width < 360 && { paddingHorizontal: 12 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="SkillHub — về đầu trang"
            onPress={() => scroll.current?.scrollTo({ y: 0, animated: true })}
          >
            <BrandLogo />
          </Pressable>
          {width >= 768 && (
            <View style={styles.nav}>
              <Pressable
                accessibilityRole="button"
                onPress={() => scrollTo("categories")}
              >
                <Text style={styles.navText}>Khám phá</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => scrollTo("how")}
              >
                <Text style={styles.navText}>Cách hoạt động</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.auth}>
            <Pressable
              accessibilityRole="button"
              onPress={() => openAuth("Đăng nhập")}
              style={({ pressed }) => [
                styles.headerButton,
                width < 400 && styles.smallButton,
                width < 360 && styles.tinyButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.login}>Đăng nhập</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => openAuth("Đăng ký")}
              style={({ pressed }) => [
                styles.headerButton,
                styles.registerButton,
                width < 400 && styles.smallButton,
                width < 360 && styles.tinyButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.register}>Đăng ký</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <ScrollView ref={scroll} style={styles.scroll}>
        <WelcomeHero
          onRegister={() => openAuth("Đăng ký")}
          onExplore={() => scrollTo("categories")}
        />
        <WelcomeSections
          onRegister={() => openAuth("Đăng ký")}
          onLink={onLink}
          onSectionLayout={onSectionLayout}
        />
      </ScrollView>
      <WelcomeNotice title={notice} onClose={() => setNotice(null)} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  headerBorder: {
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cream,
  },
  header: {
    height: 64,
    width: "100%",
    maxWidth: layout.maxWidth,
    alignSelf: "center",
    paddingHorizontal: layout.gutter,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  nav: { flexDirection: "row", gap: 24 },
  navText: {
    includeFontPadding: false,
    fontFamily: fonts.semibold,
    color: colors.muted,
    fontSize: 14,
  },
  auth: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  smallButton: { paddingHorizontal: 8 },
  tinyButton: { paddingHorizontal: 4 },
  login: {
    includeFontPadding: false,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  registerButton: { backgroundColor: colors.brand },
  register: {
    includeFontPadding: false,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
  },
  pressed: { opacity: 0.75 },
  scroll: { flex: 1 },
});
