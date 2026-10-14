import { signedInChrome } from "@/constants/theme";

export const calendarColors = {
  background: "#FAF7F2",
  surface: signedInChrome.surface,
  ink: "#1C1917",
  body: "#44403C",
  muted: "#78716C",
  border: "#EFE8E1",
  orange: "#D9532F",
  orangeDark: "#C7441E",
  orangeSoft: "#FDF2EE",
  green: "#27977B",
  greenSoft: "#EAF7F0",
  segment: "#F4EFEA",
  error: "#BA1A1A",
  errorLight: "#FFEFED",
  star: "#FFB800",
  brand: signedInChrome.accent,
  brandLight: "#FFF2EC",
  sage: "#27977B",
  sageLight: "#EAF7F0",
  sand: "#F6F4F0",
} as const;

export const calendarCardShadow = "0 4px 20px rgba(90, 60, 40, 0.06)";
export const calendarButtonShadow = "0 4px 14px rgba(217, 83, 47, 0.25)";
