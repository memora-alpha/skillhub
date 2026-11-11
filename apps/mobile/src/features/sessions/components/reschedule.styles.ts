import { StyleSheet } from "react-native";
import {
  appColors as colors,
  appRadius,
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
  secondary: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.body,
  },
  confirmations: {
    gap: 10,
    padding: 12,
    borderRadius: appRadius.control,
    backgroundColor: colors.surfaceLow,
  },
  confirmationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  error: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.error,
  },
});
