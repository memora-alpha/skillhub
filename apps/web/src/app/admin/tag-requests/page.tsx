import { TagRequestsScreen } from "@/components/staff/tags";
export default async function Page({
  searchParams,
}: Readonly<{ searchParams: Promise<{ requestId?: string }> }>) {
  const { requestId } = await searchParams;
  return <TagRequestsScreen initialRequestId={requestId} />;
}
