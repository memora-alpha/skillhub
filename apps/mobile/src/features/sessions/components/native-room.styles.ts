import { StyleSheet } from "react-native";
import { appColors, appRadius, fonts } from "@/constants/theme";

export const roomStyles = StyleSheet.create({
  page: { gap: 12, backgroundColor: "#202124", padding: 14, borderRadius: 18 },
  fullscreen: { flex: 1, backgroundColor: "#202124" },
  fullscreenContent: { padding: 12, gap: 12 },
  status: { fontFamily: fonts.semibold, color: "#f1f3f4", fontSize: 16 },
  grid: { gap: 12 },
  tile: {
    borderRadius: appRadius.card,
    backgroundColor: appColors.ink,
    overflow: "hidden",
  },
  thumbnail: { width: 150 },
  thumbnails: { gap: 10 },
  textButton: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#5f6368",
    borderRadius: 10,
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
