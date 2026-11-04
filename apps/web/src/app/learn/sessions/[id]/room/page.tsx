import { LearningRoomScreen } from "@/features/learner/livekit/room-screen";
export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return <LearningRoomScreen key={id} id={id} />;
}
