import { StyleSheet } from "react-native";
import { appColors, appRadius, fonts, typography } from "@/constants/theme";

export const materialOrderStyles = StyleSheet.create({
  card: {
    padding: 12,
    gap: 10,
    borderRadius: appRadius.card,
    borderWidth: 1,
    borderColor: appColors.border,
    backgroundColor: appColors.surface,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  content: { flex: 1, minWidth: 0, gap: 4 },
  fallback: {
    width: 64,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appRadius.control,
    backgroundColor: appColors.surfaceLow,
  },
  summary: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    maxWidth: "45%",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: appRadius.full,
    backgroundColor: appColors.surfaceLow,
  },
  purchased: { backgroundColor: appColors.successSoft },
  badgeLabel: {
    fontFamily: fonts.semibold,
    ...typography.caption,
    color: appColors.muted,
  },
  purchasedLabel: { color: appColors.success },
  amount: { flex: 1, minWidth: 0, alignItems: "flex-end", gap: 1 },
  price: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: appColors.ink,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { flexGrow: 1, flexBasis: 110, paddingHorizontal: 10, gap: 6 },
  refundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: appColors.border,
  },
  refundHint: { flex: 1, minWidth: 0 },
});
