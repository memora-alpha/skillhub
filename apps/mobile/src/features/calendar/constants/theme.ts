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
  error: "#BA1A1A",
  errorLight: "#FFEFED",
  star: "#FFB800",
  brand: signedInChrome.accent,
  brandLight: "#FFF2EC",
  sage: "#27977B",
  sageLight: "#EAF7F0",
  sand: appColors.surfaceLow,
} as const;

export const calendarCardShadow = "0 4px 16px rgba(53, 43, 31, 0.045)";
