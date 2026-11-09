import { StyleSheet } from "react-native";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export const historyStyles = StyleSheet.create({
  stack: { gap: 20 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heading: { ...typography.heading, fontFamily: fonts.bold, color: colors.ink },
  caption: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  day: { gap: 10 },
  dayLabel: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.muted,
  },
  card: {
    borderRadius: appRadius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
  },
  event: { flexDirection: "row", gap: 12 },
  rail: { width: 10, alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: appRadius.full, marginTop: 7 },
  line: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: 5,
    marginBottom: 5,
  },
  eventBody: { flex: 1, minWidth: 0, paddingBottom: 20, gap: 5 },
  lastEvent: { paddingBottom: 0 },
  eventHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  eventTitle: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.ink,
    flex: 1,
    minWidth: 0,
  },
  deltaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: appRadius.badge,
  },
  delta: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    fontVariant: ["tabular-nums"],
  },
  meta: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  empty: {
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderRadius: appRadius.card,
    backgroundColor: colors.surfaceLow,
  },
  emptyTitle: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.ink,
    textAlign: "center",
  },
  emptyText: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
    textAlign: "center",
  },
});
