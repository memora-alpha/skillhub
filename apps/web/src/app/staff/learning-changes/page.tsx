import { TerminationsScreen } from "@/components/staff/terminations";
export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ requestId?: string; pathId?: string }>;
}>) {
  const { requestId, pathId } = await searchParams;
  return (
    <TerminationsScreen initialRequestId={requestId} initialPathId={pathId} />
  );
}
