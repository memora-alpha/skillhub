import { StyleSheet } from "react-native";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

export const cancellationStyles = StyleSheet.create({
  surface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
    padding: 20,
    gap: 20,
  },
  header: { gap: 8 },
  eyebrow: {
    ...typography.caption,
    fontFamily: fonts.bold,
    letterSpacing: 1.2,
    color: colors.muted,
  },
  title: { ...typography.title, fontFamily: fonts.bold, color: colors.ink },
  label: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.muted,
  },
  reason: {
    gap: 6,
    borderLeftWidth: 2,
    borderColor: colors.borderStrong,
    paddingLeft: 12,
  },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
    flex: 1,
  },
  footnote: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
});
