import { appColors, signedInChrome } from "@/constants/theme";

export const calendarColors = {
  background: signedInChrome.background,
  surface: signedInChrome.surface,
  ink: signedInChrome.ink,
  body: "#534D47",
  muted: "#97928A",
  border: signedInChrome.border,
  orange: signedInChrome.accent,
  orangeDark: "#D95120",
  orangeSoft: "#FFF2EC",
  green: "#27977B",
  greenSoft: "#EAF7F0",
  segment: appColors.surfaceInset,
} as const;

export const calendarCardShadow = "0 4px 20px rgba(90, 60, 40, 0.06)";
export const calendarButtonShadow = "0 4px 14px rgba(217, 83, 47, 0.25)";
