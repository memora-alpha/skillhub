import { View } from "react-native";
import { Avatar } from "@/components/Avatar";

export function ChatParticipantAvatar({
  mine,
  showAvatar,
  partner,
  partnerId,
  avatarUrl,
  size,
}: Readonly<{
  mine: boolean;
  showAvatar: boolean;
  partner: string;
  partnerId: string;
  avatarUrl?: string | null;
  size: number;
}>) {
  if (mine) return null;
  if (!showAvatar) return <View style={{ width: size }} />;
  return (
    <Avatar
      name={partner}
      userId={partnerId}
      sourceUri={avatarUrl}
      size={size}
    />
  );
}
