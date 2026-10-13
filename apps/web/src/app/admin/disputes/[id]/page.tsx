import { ReportDetailScreen } from "@/components/staff/reports";
export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return <ReportDetailScreen key={id} id={id} />;
}
