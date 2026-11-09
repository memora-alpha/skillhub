import { StyleSheet } from "react-native";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export const policyStyles = StyleSheet.create({
  modal: {
    maxWidth: 440,
    gap: 16,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  modalTitle: {
    ...typography.heading,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  stack: { gap: 16 },
  scoreCard: {
    padding: 16,
    borderRadius: appRadius.control,
    backgroundColor: colors.surfaceLow,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  scoreInfo: { gap: 4 },
  label: {
    ...typography.secondary,
    fontFamily: fonts.medium,
    color: colors.muted,
  },
  score: {
    ...typography.title,
    fontFamily: fonts.bold,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  scoreTotal: {
    ...typography.body,
    fontFamily: fonts.medium,
    color: colors.muted,
  },
  section: { gap: 10 },
  heading: { ...typography.body, fontFamily: fonts.bold, color: colors.ink },
  restriction: {
    gap: 6,
    padding: 14,
    borderRadius: appRadius.control,
    backgroundColor: colors.amberSoft,
  },
  restrictionTitle: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  body: { ...typography.body, fontFamily: fonts.body, color: colors.body },
  note: { ...typography.secondary, fontFamily: fonts.body, color: colors.body },
  rules: { gap: 14 },
  rule: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ruleNumber: {
    width: 24,
    height: 24,
    borderRadius: appRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceInset,
  },
  number: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.body,
  },
  ruleText: {
    ...typography.body,
    fontFamily: fonts.body,
    color: colors.body,
    flex: 1,
    minWidth: 0,
  },
  footnote: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
});
