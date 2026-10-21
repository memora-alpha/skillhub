import { Fragment } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { typography, colors, fonts, layout } from "@/constants/theme";
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
          style={[styles.title, wide && styles.wideTitle]}
        >
          {"Chia sẻ điều\nbạn biết.\n"}
          <Text style={styles.accent}>Học điều</Text>
          {"\nbạn muốn."}
        </Text>
        <Text style={styles.description}>
          Kết nối với những người có kỹ năng phù hợp, cùng tạo Learning Path và
          học trực tiếp 1:1.
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
    paddingTop: 48,
    paddingBottom: 48,
    gap: 32,
  },
  wide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 56,
    paddingTop: 56,
    paddingBottom: 40,
  },
  column: { flex: 1 },
  copy: { gap: 20 },
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
    ...typography.body,
    color: colors.brand,
  },
  title: {
    includeFontPadding: false,
    fontFamily: fonts.bold,
    fontSize: 34,
    lineHeight: 42,
    color: colors.ink,
  },
  wideTitle: { fontSize: 46, lineHeight: 56 },
  accent: { color: colors.brand },
  description: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
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
    gap: 20,
    paddingTop: 4,
    flexWrap: "wrap",
  },
  stat: { alignItems: "center" },
  value: {
    includeFontPadding: false,
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.brand,
  },
  statLabel: {
    includeFontPadding: false,
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
  divider: { width: 1, height: 32, backgroundColor: colors.border },
});
