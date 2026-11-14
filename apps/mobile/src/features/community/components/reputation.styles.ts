import { StyleSheet } from "react-native";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export const reputationStyles = StyleSheet.create({
  stack: { gap: 16 },
  section: { gap: 12 },
  card: {
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  heading: { fontFamily: fonts.bold, ...typography.heading, color: colors.ink },
  label: { fontFamily: fonts.semibold, ...typography.body, color: colors.ink },
  body: { fontFamily: fonts.body, ...typography.body, color: colors.body },
  meta: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
  number: {
    fontFamily: fonts.bold,
    ...typography.amount,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  total: { fontFamily: fonts.medium, ...typography.body, color: colors.muted },
  track: {
    height: 6,
    borderRadius: appRadius.full,
    backgroundColor: colors.surfaceInset,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: appRadius.full },
  status: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: appRadius.full,
    backgroundColor: colors.forest,
  },
  statusText: {
    flex: 1,
    fontFamily: fonts.medium,
    ...typography.secondary,
    color: colors.forest,
  },
  item: { gap: 6 },
  separator: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: appRadius.badge,
    backgroundColor: colors.forestSoft,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.forest,
  },
  reward: {
    fontFamily: fonts.bold,
    ...typography.secondary,
    color: colors.forest,
    fontVariant: ["tabular-nums"],
  },
  answers: { flexDirection: "row", gap: 8 },
  answer: { flex: 1 },
});
