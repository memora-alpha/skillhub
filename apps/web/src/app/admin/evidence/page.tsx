import { EvidenceScreen } from "@/components/staff/evidence";
export default async function Page({
  searchParams,
}: Readonly<{ searchParams: Promise<{ verificationId?: string }> }>) {
  const { verificationId } = await searchParams;
  return <EvidenceScreen initialVerificationId={verificationId} />;
}
