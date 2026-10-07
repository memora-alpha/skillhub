export const avatarPalette = [
  { background: "#FFE3D5", foreground: "#9A3D20" },
  { background: "#DDF3E7", foreground: "#21634A" },
  { background: "#DDEBFA", foreground: "#285B8A" },
  { background: "#EDE1FA", foreground: "#69418A" },
  { background: "#FFF0C7", foreground: "#785B12" },
] as const;

const avatarOverrides: Record<string, (typeof avatarPalette)[number]> = {
  "demo-viet-anh": avatarPalette[0],
  "demo-minh-ha": avatarPalette[4],
  "demo-quang-huy": avatarPalette[3],
};

export function getAvatarColors(userId: string) {
  if (userId.startsWith("demo-user:")) return avatarPalette[0];
  const override = avatarOverrides[userId];
  if (override) return override;
  let hash = 2166136261;
  for (let index = 0; index < userId.length; index += 1) {
    hash = Math.imul(hash ^ userId.charCodeAt(index), 16777619);
  }
  return avatarPalette[(hash >>> 0) % avatarPalette.length]!;
}
