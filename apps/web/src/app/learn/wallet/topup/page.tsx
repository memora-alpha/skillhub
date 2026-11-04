import { TopupScreen } from "@/features/learner/account/topup-screen";
export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ paymentId?: string }>;
}>) {
  const { paymentId } = await searchParams;
  const id =
    typeof paymentId === "string" && /^[0-9a-f-]{36}$/i.test(paymentId)
      ? paymentId
      : undefined;
  return <TopupScreen key={id ?? "new"} paymentId={id} />;
}
