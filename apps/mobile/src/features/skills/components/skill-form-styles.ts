import { StyleSheet } from "react-native";
import { appColors as colors, fonts, typography } from "@/constants/theme";

export const formStyles = StyleSheet.create({
  section: {
    padding: 18,
    gap: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sectionHeading: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.ink,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { padding: 9, borderRadius: 12, backgroundColor: colors.primarySoft },
  label: { fontFamily: fonts.semibold, ...typography.body, color: colors.ink },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  levelGuide: {
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceLow,
  },
  option: {
    flexGrow: 1,
    flexBasis: "45%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  selectedText: { color: colors.primary },
  selector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footer: { gap: 12 },
});
