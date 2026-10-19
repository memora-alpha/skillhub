export const colors = {
  brand: "#D4622A",
  brandHover: "#B8521E",
  brandLight: "#FEF0E8",
  brandMuted: "#F5D4C0",
  brandSurface: "#F6D3BA",
  sage: "#3D6B5A",
  cream: "#FFFCF8",
  white: "#FFFFFF",
  ink: "#1C1410",
  inkSoft: "#3D2E24",
  body: "#5C4A3A",
  muted: "#8A7060",
  mutedLight: "#BCA99A",
  border: "#E2D9CE",
  borderDark: "#C8BDB0",
  sand: "#F7F1E9",
  success: "#2E7D53",
  warning: "#D4901A",
  star: "#FBBF24",
  error: "#C03030",
  errorLight: "#FDEAEA",
  successLight: "#E6F4ED",
  sageLight: "#EAF2EE",
  warningLight: "#FEF3DC",
  gold: "#B8860B",
} as const;

export const gradients = {
  discoveryCard: [colors.white, "#FFF9F4", "#FCEBDD"],
} as const;

export const fonts = {
  body: "NunitoRegular",
  medium: "NunitoMedium",
  semibold: "NunitoSemibold",
  bold: "NunitoBold",
  black: "NunitoBlack",
  italic: "NunitoItalic",
  display: "FrauncesSemibold",
  displayBold: "FrauncesBold",
} as const;

export const typography = {
  caption: { fontSize: 11, lineHeight: 15 },
  secondary: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 15, lineHeight: 22 },
  heading: { fontSize: 17, lineHeight: 24 },
  title: { fontSize: 20, lineHeight: 28 },
  amount: { fontSize: 32, lineHeight: 40 },
} as const;

export const iconSizes = {
  inline: 14,
  control: 18,
  navigation: 22,
  feature: 24,
} as const;

export const avatarSizes = {
  inline: 24,
  compact: 32,
  list: 40,
  profile: 64,
  edit: 96,
} as const;

export const layout = {
  gutter: 20,
  maxWidth: 1152,
  sectionPadding: 64,
  radius: 6,
} as const;

export const radius = {
  badge: 4,
  control: layout.radius,
  card: 8,
} as const;

// Stitch "Crafted Exchange" tokens used by the signed-in product surfaces.
// The public/auth experience keeps the original palette above.
export const appColors = {
  primary: "#BA4E36",
  primaryDark: "#9A3721",
  primaryPressed: "#832612",
  primarySoft: "#FFF2F0",
  primaryMuted: "#FFDAD2",
  forest: "#264E3F",
  forestSoft: "#E7F2EC",
  forestMuted: "#BDE9D5",
  amber: "#D97736",
  amberSoft: "#FFF1E7",
  canvas: "#FCF9F3",
  surface: "#FFFFFF",
  surfaceLow: "#F6F3ED",
  surfaceInset: "#EDE8DF",
  surfaceHigh: "#E5E2DC",
  ink: "#1C2520",
  body: "#57423D",
  muted: "#8A716C",
  mutedLight: "#A9958F",
  border: "#E2DCD2",
  borderStrong: "#D8CFC4",
  success: "#2D6A4F",
  successSoft: "#E7F3EC",
  warning: "#C85A17",
  error: "#BA1A1A",
  white: "#FFFFFF",
  // Familiar aliases keep feature styles readable while using the Stitch palette.
  brand: "#BA4E36",
  brandHover: "#9A3721",
  brandLight: "#FFF2F0",
  brandMuted: "#FFDAD2",
  brandSurface: "#FFDAD2",
  sage: "#264E3F",
  sageLight: "#E7F2EC",
  cream: "#FCF9F3",
  inkSoft: "#57423D",
  sand: "#EDE8DF",
  warningLight: "#FFF1E7",
  gold: "#D97736",
  star: "#D97736",
  errorLight: "#FFEFED",
} as const;

export const appRadius = {
  badge: 8,
  control: 8,
  card: 16,
  feature: 24,
  full: 999,
} as const;

export const skillBadgeColors = {
  VERIFIED: { color: "#24654F", background: "#E9F5EE", border: "#D0E9D9" },
  UNVERIFIED: { color: "#6C625B", background: "#F3EEE6", border: "#E4DDD3" },
  PENDING: { color: "#91621A", background: "#FFF5DE", border: "#F2E1BA" },
  REJECTED: { color: "#B14347", background: "#FCEEF0", border: "#F2D7DC" },
} as const;

export const skillLevelColors = {
  color: "#9A4F3D",
  background: "#FBEFE9",
  border: "#F0DED3",
} as const;

export const appGradients = {
  discoveryCard: [appColors.surface, appColors.surfaceLow],
} as const;

// Shared chrome for every signed-in screen: header, logo and bottom navigation.
export const signedInChrome = {
  background: "#FCFAF7",
  surface: "#FFFFFF",
  ink: "#202521",
  muted: "#AAA69F",
  border: "#F0ECE6",
  accent: "#EF653D",
} as const;

export const toastTheme = {
  surface: colors.white,
  border: colors.border,
  foreground: colors.inkSoft,
  closeForeground: colors.muted,
  closePressed: colors.sand,
  radius: appRadius.card,
  gutter: 16,
  padding: 12,
  gap: 12,
  minHeight: 64,
  maxWidth: 448,
  dismissSize: 44,
  shadow: "0 8px 24px rgba(28, 20, 16, 0.10), 0 2px 6px rgba(28, 20, 16, 0.04)",
  tones: {
    success: { foreground: colors.success, background: colors.successLight },
    error: { foreground: colors.error, background: colors.errorLight },
    info: { foreground: colors.brand, background: colors.brandLight },
  },
} as const;
