export type RoomPerson = { name: string; avatarUrl: string | null };
export type PublicRoomProfile = {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
};

export function roomPerson(
  profile: PublicRoomProfile | undefined,
  userId: string | undefined,
): RoomPerson | undefined {
  if (
    !profile ||
    profile.userId !== userId ||
    typeof profile.fullName !== "string" ||
    !profile.fullName.trim()
  )
    return;
  return {
    name: profile.fullName.trim(),
    avatarUrl: safeRoomAvatar(profile.avatarUrl),
  };
}

export function safeRoomAvatar(value: string | null | undefined) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    return url.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      ? value
      : null;
  } catch {
    return null;
  }
}

export function roomInitials(name: string) {
  const words = name
    .replace(/\s*\(Bạn\)$/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (
    words.length > 1
      ? (words[0]?.[0] ?? "") + (words.at(-1)?.[0] ?? "")
      : (words[0]?.[0] ?? "?")
  ).toLocaleUpperCase("vi-VN");
}
