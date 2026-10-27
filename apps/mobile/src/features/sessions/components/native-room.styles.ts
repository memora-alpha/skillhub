import { StyleSheet } from "react-native";
import { appColors, appRadius, fonts } from "@/constants/theme";

export const roomStyles = StyleSheet.create({
  page: { gap: 12 },
  status: { fontFamily: fonts.semibold, color: appColors.ink, fontSize: 16 },
  grid: { gap: 12 },
  tile: {
    minHeight: 210,
    borderRadius: appRadius.card,
    backgroundColor: appColors.ink,
    overflow: "hidden",
  },
  video: { width: "100%", height: 240 },
  placeholder: {
    minHeight: 210,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  placeholderText: {
    fontFamily: fonts.medium,
    color: appColors.white,
    textAlign: "center",
  },
  name: { padding: 10, color: appColors.white, fontFamily: fonts.semibold },
  controls: { gap: 8 },
  controlRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  control: { flexGrow: 1, flexBasis: 140, minHeight: 48 },
  leave: { backgroundColor: appColors.error },
});
