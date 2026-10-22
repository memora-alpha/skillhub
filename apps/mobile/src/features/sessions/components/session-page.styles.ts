import { StyleSheet } from "react-native";
import {
  appColors as colors,
  fonts,
  typography,
  signedInChrome,
} from "@/constants/theme";

export const sessionUi = StyleSheet.create({
  background: { backgroundColor: signedInChrome.background },
  page: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    padding: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 18,
  },
  panel: {
    backgroundColor: colors.surface,
    padding: 20,
    gap: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accent: { backgroundColor: colors.forestSoft },
  heading: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.ink,
    flexShrink: 1,
  },
  body: { fontFamily: fonts.body, ...typography.body, color: colors.body },
  secondary: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.body,
  },
  preview: {
    fontFamily: fonts.bold,
    ...typography.caption,
    color: colors.primary,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  badge: { flexShrink: 1, maxWidth: "65%" },
  metadata: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  grow: { flex: 1, minWidth: 0, gap: 4 },
  action: { minHeight: 50, borderRadius: 16, paddingHorizontal: 16 },
  actionLabel: {
    fontFamily: fonts.bold,
    ...typography.body,
    color: colors.white,
    textAlign: "center",
    flexShrink: 1,
  },
  secondaryActionLabel: { color: colors.ink },
});
