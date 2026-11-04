import { ReportDetail } from "@/features/learner/account/report-detail";
export default async function Page({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <ReportDetail key={id} id={id} />;
}
