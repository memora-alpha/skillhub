import { StyleSheet } from "react-native";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export const changePanelStyles = StyleSheet.create({
  embedded: { gap: 12 },
  toggleLabel: {
    flex: 1,
    minWidth: 0,
    textAlign: "left",
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.body,
  },
  requestToggle: {
    minHeight: 48,
    paddingHorizontal: 0,
    justifyContent: "space-between",
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: appRadius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 16,
  },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heading: {
    flex: 1,
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.ink,
  },
  request: {
    backgroundColor: colors.surfaceLow,
    borderRadius: appRadius.control,
    padding: 12,
    gap: 12,
  },
  status: { fontFamily: fonts.bold, ...typography.body, color: colors.forest },
});
