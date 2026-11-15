import { FinanceScreen } from "@/components/staff/finance";

export default async function Page({
  searchParams,
}: Readonly<{ searchParams: Promise<{ tab?: string; paymentId?: string }> }>) {
  const params = await searchParams;
  return (
    <FinanceScreen
      initialTab={params.tab}
      initialPaymentId={params.paymentId}
    />
  );
}
