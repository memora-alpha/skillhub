import { MaterialDetail } from "@/features/learner/account/material-detail";
export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return <MaterialDetail key={id} id={id} />;
}
