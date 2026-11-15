import { SupportQueueScreen } from "@/components/staff/report-support";
export default async function Page({
  searchParams,
}: Readonly<{ searchParams: Promise<{ incidentId?: string }> }>) {
  const { incidentId } = await searchParams;
  return <SupportQueueScreen initialIncidentId={incidentId} />;
}
