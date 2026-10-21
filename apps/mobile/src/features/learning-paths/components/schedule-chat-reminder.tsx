import { useRouter } from "expo-router";
import { Button } from "@/components/Button";

export function ScheduleChatReminder({
  conversationId,
  blocked,
}: Readonly<{
  conversationId: string;
  blocked: boolean;
}>) {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      leadingIcon="message"
      disabled={blocked}
      onPress={() => {
        if (blocked) return;
        router.dismissTo({
          pathname: "/chat/[proposalId]",
          params: { proposalId: conversationId, mode: "api" },
        });
      }}
    >
      Nhắc đối tác qua chat
    </Button>
  );
}
