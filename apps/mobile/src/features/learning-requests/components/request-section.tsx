import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { appColors, appRadius, fonts, typography } from "@/constants/theme";
import { Icon, type IconName } from "@/components/Icon";

export function RequestSection({
  title,
  children,
  icon,
  tone = "primary",
  subtitle,
  compact = false,
}: {
  title: string;
  children: ReactNode;
  icon?: IconName;
  tone?: "primary" | "forest" | "amber";
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.section, compact && styles.compact]}>
      <View style={[styles.header, compact && { paddingBottom: 10 }]}>
        {!!icon && (
          <View
            style={[
              styles.icon,
              compact && { width: 26, height: 26, borderRadius: 8 },
              {
                backgroundColor:
                  tone === "forest"
                    ? appColors.forestSoft
                    : appColors.amberSoft,
              },
            ]}
          >
            <Icon
              name={icon}
              size={compact ? 16 : 18}
              color={appColors[tone]}
            />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  compact: { padding: 16, gap: 12, borderRadius: appRadius.card },
  section: {
    padding: 18,
    gap: 18,
    borderRadius: appRadius.feature,
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: appColors.surfaceInset,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    fontFamily: fonts.body,
    ...typography.caption,
    color: appColors.muted,
  },
  title: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: appColors.ink,
  },
});
