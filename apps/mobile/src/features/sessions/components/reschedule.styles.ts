import { StyleSheet } from "react-native";
import {
  appColors as colors,
  fonts,
  typography,
  signedInChrome,
} from "@/constants/theme";

export const rescheduleStyles = StyleSheet.create({
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
  card: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  heading: { fontFamily: fonts.bold, ...typography.heading, color: colors.ink },
  body: { fontFamily: fonts.body, ...typography.body, color: colors.ink },
  secondary: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.body,
  },
  current: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  grow: { flex: 1, minWidth: 0, gap: 4 },
  action: { borderRadius: 16, minHeight: 50 },
  actionLabel: {
    fontFamily: fonts.bold,
    ...typography.body,
    color: colors.white,
    flexShrink: 1,
    textAlign: "center",
  },
  error: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.error,
  },
});
