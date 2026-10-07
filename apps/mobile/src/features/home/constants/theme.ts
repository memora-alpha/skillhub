import { signedInChrome } from "@/constants/theme";

export const homeColors = {
  background: signedInChrome.background,
  surface: signedInChrome.surface,
  ink: signedInChrome.ink,
  body: "#534D47",
  muted: "#97928A",
  border: signedInChrome.border,
  orange: signedInChrome.accent,
  orangeDark: "#C74623",
  orangeSoft: "#FFF0E8",
  sessionStart: "#F8D8C5",
  sessionEnd: "#F3BFA6",
  green: "#27977B",
  greenSoft: "#EAF7F0",
  yellow: "#FFB800",
  yellowSoft: "#FFF7DD",
  blue: "#24B3DA",
  track: "#F3F4F6",
} as const;

export const homeCardShadow = "0 4px 16px rgba(53, 43, 31, 0.045)";
