import type { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export { RouteButton } from "@/components/feature-page";

// Wallet uses the same Nunito ramp as Home/Profile, including preview surfaces.
export function Panel({
  title,
  children,
  accent = false,
  testID,
  style,
}: {
  title?: string;
  children: ReactNode;
  accent?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View testID={testID} style={[ui.panel, accent && ui.accent, style]}>
      {title && (
        <Text accessibilityRole="header" style={ui.heading}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}
export function Copy({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <Text selectable style={[ui.copy, muted && ui.muted]}>
      {children}
    </Text>
  );
}
export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={ui.metric}>
      <Text style={ui.label}>{label}</Text>
      <Text selectable style={ui.number}>
        {value}
      </Text>
    </View>
  );
}
export function WalletField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={ui.field}>
      <Text style={ui.label}>{label}</Text>
      <Text selectable style={ui.fieldValue}>
        {value}
      </Text>
    </View>
  );
}
export const ui = StyleSheet.create({
  page: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    padding: 20,
    paddingBottom: 36,
    gap: 20,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: appRadius.card,
    padding: 20,
    gap: 16,
  },
  accent: { backgroundColor: colors.forestSoft },
  heading: { fontFamily: fonts.bold, ...typography.heading, color: colors.ink },
  copy: { fontFamily: fonts.body, ...typography.body, color: colors.body },
  muted: { color: colors.muted },
  label: {
    fontFamily: fonts.medium,
    ...typography.secondary,
    color: colors.body,
  },
  number: {
    fontFamily: fonts.bold,
    ...typography.title,
    color: colors.forest,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
  metric: { flex: 1, minWidth: 110, gap: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  field: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
    paddingVertical: 8,
  },
  fieldValue: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
    flexShrink: 1,
  },
});
