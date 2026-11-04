import { ReportForm } from "@/features/learner/account/reports-screen";
export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ sessionId?: string; materialId?: string }>;
}>) {
  const p = await searchParams;
  const valid = (v: unknown): v is string =>
    typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
  const sessionId = valid(p.sessionId) ? p.sessionId : undefined,
    materialId = !sessionId && valid(p.materialId) ? p.materialId : undefined;
  return (
    <ReportForm
      key={sessionId ?? materialId ?? "none"}
      sessionId={sessionId}
      materialId={materialId}
    />
  );
}
