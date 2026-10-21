import { useLocalSearchParams } from "expo-router";
import { ApiChatScreen } from "./ApiChatScreen";

export function ChatScreen() {
  const params = useLocalSearchParams<{
    proposalId?: string | string[];
  }>();
  const id = Array.isArray(params.proposalId)
    ? params.proposalId[0]
    : params.proposalId;
  return <ApiChatScreen id={id ?? ""} />;
}
