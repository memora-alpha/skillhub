import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Icon, type IconName } from "@/components/Icon";
import { appColors, fonts, typography } from "@/constants/theme";
import { requestDetailStyles } from "./request-detail.styles";

export function RequestDetailSection({
  title,
  icon,
  tone = "primary",
  children,
}: {
  title: string;
  icon: IconName;
  tone?: "primary" | "forest" | "amber";
  children: ReactNode;
}) {
  return (
    <View
      style={[requestDetailStyles.card, tone === "forest" && styles.exchange]}
    >
      {tone === "forest" && (
        <LinearGradient
          colors={[appColors.forestSoft, appColors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      <View style={styles.header}>
        <View
          style={[
            styles.icon,
            {
              backgroundColor:
                tone === "forest" ? appColors.forestMuted : appColors.amberSoft,
            },
          ]}
        >
          <Icon name={icon} size={18} color={appColors[tone]} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  exchange: { borderColor: appColors.forestMuted },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontFamily: fonts.bold,
    ...typography.heading,
    color: appColors.ink,
  },
});
