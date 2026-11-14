export const avatarPalette = [
  { background: "#FFE3D5", foreground: "#9A3D20" },
  { background: "#DDF3E7", foreground: "#21634A" },
  { background: "#DDEBFA", foreground: "#285B8A" },
  { background: "#EDE1FA", foreground: "#69418A" },
  { background: "#FFF0C7", foreground: "#785B12" },
] as const;

export function getAvatarColors(userId: string) {
  let hash = 2166136261;
  for (const character of userId) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  }
  return avatarPalette[(hash >>> 0) % avatarPalette.length]!;
}
