import { signedInChrome } from "@/constants/theme";

export const profileColors = {
  background: signedInChrome.background,
  surface: signedInChrome.surface,
  ink: signedInChrome.ink,
  border: signedInChrome.border,
  accent: signedInChrome.accent,
  body: "#5A5550",
  muted: "#8D8881",
  mutedStrong: "#77716B",
  neutral: "#F5F4F2",
  accentSoft: "#FFF5EF",
  badge: "#FFF8EF",
  badgeBorder: "#FFE3BE",
  verified: "#24956C",
  verifiedSoft: "#E7F8F1",
} as const;

export const profileShadows = {
  hero: "0 3px 10px rgba(53, 43, 31, 0.04)",
  section: "0 2px 8px rgba(53, 43, 31, 0.04)",
  action: "0 2px 6px rgba(53, 43, 31, 0.03)",
  actionRaised: "0 4px 10px rgba(53, 43, 31, 0.10)",
} as const;

export const profileStatColors = [
  profileColors.accent,
  "#2B9D91",
  "#E66B4A",
  profileColors.accent,
] as const;

export const profileActionTints: Readonly<Record<string, string>> = {
  wallet: "#FFF1E9",
  book: "#EAF8F6",
  award: "#FFF7DE",
  shield: "#F0EEFF",
  star: "#FFF7DE",
  settings: profileColors.neutral,
};
