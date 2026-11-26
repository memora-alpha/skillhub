import { VouchersScreen } from "@/features/learner/rewards/vouchers-screen";
export default async function Page({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <VouchersScreen productId={id} />;
}
