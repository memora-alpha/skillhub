import { ConnectionsScreen } from "@/features/learner/connections/connections-screen";
export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ learningRequestId?: string; direction?: string }>;
}>) {
  const { learningRequestId, direction } = await searchParams;
  const requestId =
    learningRequestId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      learningRequestId,
    )
      ? learningRequestId
      : undefined;
  return (
    <ConnectionsScreen
      key={requestId ?? "all"}
      requestId={requestId}
      initialDirection={direction === "sent" ? "sent" : "received"}
    />
  );
}
