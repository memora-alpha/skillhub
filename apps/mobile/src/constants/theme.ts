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
