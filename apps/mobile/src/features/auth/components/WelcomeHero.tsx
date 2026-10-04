import { Fragment } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { colors, fonts, layout } from "@/constants/theme";
import { welcomeStats } from "../mocks/welcome";
import { WelcomeVisual } from "./WelcomeVisual";

export function WelcomeHero({
  onRegister,
  onExplore,
}: {
  onRegister: () => void;
  onExplore: () => void;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 1024;
  return (
    <View style={[styles.container, wide && styles.wide]}>
      <View style={[styles.copy, wide && styles.column]}>
        <View style={styles.pill}>
          <Icon name="zap" size={14} />
          <Text style={styles.pillText}>Cộng đồng học kỹ năng 1:1</Text>
        </View>
        <Text
          accessibilityRole="header"
          style={[styles.title, wide && { fontSize: 60, lineHeight: 75 }]}
        >
          {"Chia sẻ điều\nbạn biết.\n"}
          <Text style={styles.accent}>Học điều</Text>
          {"\nbạn muốn."}
        </Text>
        <Text style={styles.description}>
          Kết nối với những người có kỹ năng phù hợp, cùng tạo lộ trình và học
          trực tiếp 1:1.
        </Text>
        <View
          style={[styles.actions, width >= 640 && { flexDirection: "row" }]}
        >
          <Button size="lg" onPress={onRegister}>
            Bắt đầu miễn phí
          </Button>
          <Button size="lg" variant="secondary" onPress={onExplore}>
            <Icon name="compass" color={colors.inkSoft} />
            <Text style={styles.exploreText}>Khám phá SkillHub</Text>
          </Button>
        </View>
        <View style={[styles.stats, width < 360 && { gap: 12 }]}>
          {welcomeStats.map((stat, index) => (
            <Fragment key={stat.label}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.stat}>
                <Text style={styles.value}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            </Fragment>
          ))}
        </View>
      </View>
      <View style={wide && styles.column}>
        <WelcomeVisual />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: layout.maxWidth,
    alignSelf: "center",
    paddingHorizontal: layout.gutter,
    paddingTop: 80,
    paddingBottom: layout.sectionPadding,
    gap: 48,
  },
  wide: { flexDirection: "row", alignItems: "center" },
  column: { flex: 1 },
  copy: { gap: 24 },
  pill: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brandLight,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  pillText: {
    includeFontPadding: false,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.brand,
  },
  title: {
    includeFontPadding: false,
    fontFamily: fonts.displayBold,
    fontSize: 48,
    lineHeight: 60,
    color: colors.ink,
  },
  accent: { color: colors.brand },
  description: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 29.25,
    color: colors.body,
    maxWidth: 448,
  },
  actions: { gap: 12 },
  exploreText: {
    includeFontPadding: false,
    fontFamily: fonts.semibold,
    color: colors.inkSoft,
    fontSize: 16,
    lineHeight: 24,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    paddingTop: 8,
    flexWrap: "wrap",
  },
  stat: { alignItems: "center" },
  value: {
    includeFontPadding: false,
    fontFamily: fonts.displayBold,
    fontSize: 24,
    lineHeight: 32,
    color: colors.brand,
  },
  statLabel: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
  divider: { width: 1, height: 32, backgroundColor: colors.border },
});
