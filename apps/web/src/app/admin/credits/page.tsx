import { FinanceScreen } from "@/components/staff/finance";
import { readLedgerFilters } from "@/lib/staff/ledger-query";
import { readPaymentFilters } from "@/lib/staff/payment-query";

export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const params = await searchParams;
  return (
    <FinanceScreen
      key={JSON.stringify(params)}
      initialTab={typeof params.tab === "string" ? params.tab : undefined}
      initialPaymentId={
        typeof params.paymentId === "string" ? params.paymentId : undefined
      }
      initialWalletId={
        typeof params.userId === "string" ? params.userId : undefined
      }
      initialLedgerFilters={readLedgerFilters(params)}
      initialPaymentFilters={readPaymentFilters(params)}
      initialPaymentStatus={
        typeof params.status === "string" ? params.status : undefined
      }
    />
  );
}
