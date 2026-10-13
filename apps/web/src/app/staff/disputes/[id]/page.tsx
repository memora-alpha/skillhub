import { ReportDetailScreen } from "@/components/staff/reports";

export default async function StaffDisputePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReportDetailScreen key={id} id={id} />;
}
