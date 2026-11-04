import { VerificationScreen } from "@/features/learner/skills/verification-screen";
export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return <VerificationScreen key={id} id={id} />;
}
