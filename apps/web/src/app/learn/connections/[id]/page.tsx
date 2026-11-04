import { ProposalDetail } from "@/features/learner/connections/proposal-detail";
export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return <ProposalDetail key={id} id={id} />;
}
