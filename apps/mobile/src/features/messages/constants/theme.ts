import { signedInChrome } from "@/constants/theme";

export const messageColors = {
  background: signedInChrome.background,
  canvas: signedInChrome.background,
  surface: signedInChrome.surface,
  ink: signedInChrome.ink,
  inkSoft: "#5A5550",
  body: "#5A5550",
  muted: "#8D8881",
  mutedLight: "#B4AFA8",
  border: signedInChrome.border,
  orange: signedInChrome.accent,
  brand: signedInChrome.accent,
  sage: "#179B69",
  sageLight: "#ECFFF5",
  orangeSoft: "#FFF1E9",
  orangePale: "#FFF8F4",
  tag: "#F5F6F7",
  white: "#FFFFFF",
} as const;

export const messageCardShadow = "0 3px 12px rgba(53, 43, 31, 0.04)";
