import { StyleSheet } from "react-native";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export const reviewStyles = StyleSheet.create({
  stack: { gap: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  sectionTitle: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.ink,
  },
  meta: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.muted,
  },
  pathCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
    borderCurve: "continuous",
    padding: 14,
    gap: 12,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.ink,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.forestSoft,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: appRadius.badge,
  },
  statusText: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: colors.forest,
  },
  partner: { flexDirection: "row", alignItems: "center", gap: 12 },
  partnerName: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.ink,
  },
  cardFooter: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  action: {
    fontFamily: fonts.bold,
    ...typography.secondary,
    color: colors.primary,
  },
  pressed: { opacity: 0.75, backgroundColor: colors.surfaceLow },
  form: {
    padding: 14,
    gap: 12,
    borderRadius: appRadius.card,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
