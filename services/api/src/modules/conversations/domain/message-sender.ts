export type MessageSender = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export function messageSender(
  id: string,
  profile?: { fullName: string; avatarUrl: string | null },
): MessageSender {
  return {
    id,
    fullName: profile?.fullName ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
  };
}
