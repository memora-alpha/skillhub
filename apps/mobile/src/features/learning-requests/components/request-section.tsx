import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { appColors, appRadius, fonts, typography } from "@/constants/theme";
import { Icon, type IconName } from "@/components/Icon";

type SectionProps = Readonly<{
  title: string;
  children: ReactNode;
  icon?: IconName;
  tone?: "primary" | "forest" | "amber";
  subtitle?: string;
  compact?: boolean;
  collapsible?: boolean;
  summary?: string;
  hasError?: boolean;
  disabled?: boolean;
}>;

function SectionHeader({
  title,
  icon,
  tone = "primary",
  subtitle,
  summary,
  collapsible,
  expanded,
}: Readonly<Omit<SectionProps, "children"> & { expanded: boolean }>) {
  const caption = expanded ? subtitle : summary;
  return (
    <>
      {!!icon && (
        <View
          style={[
            styles.icon,
            {
              backgroundColor:
                tone === "forest" ? appColors.forestSoft : appColors.amberSoft,
            },
          ]}
        >
          <Icon name={icon} size={18} color={appColors[tone]} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {!!caption && <Text style={styles.subtitle}>{caption}</Text>}
      </View>
      {collapsible && (
        <View style={{ transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}>
          <Icon name="chevron" size={18} color={appColors.muted} />
        </View>
      )}
    </>
  );
}

export function RequestSection({
  children,
  compact = false,
  collapsible = false,
  hasError = false,
  disabled = false,
  ...headerProps
}: SectionProps) {
  const [open, setOpen] = useState(false);
  const expanded = !collapsible || open || hasError;
  const header = (
    <SectionHeader
      {...headerProps}
      collapsible={collapsible}
      expanded={expanded}
    />
  );
  return (
    <View style={[styles.section, compact && styles.compact]}>
      {collapsible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={headerProps.title}
          accessibilityState={{ expanded, disabled }}
          disabled={disabled}
          onPress={() => setOpen(!expanded)}
          style={[
            styles.header,
            { minHeight: 48 },
            !expanded && { paddingBottom: 0, borderBottomWidth: 0 },
          ]}
        >
          {header}
        </Pressable>
      ) : (
        <View style={styles.header}>{header}</View>
      )}
      <View
        style={{ gap: compact ? 12 : 18, display: expanded ? "flex" : "none" }}
      >
        {children}
      </View>
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
