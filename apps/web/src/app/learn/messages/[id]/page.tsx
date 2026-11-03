import { ChatScreen } from "@/features/learner/messages/chat-screen";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatScreen key={id} id={id} />;
}
