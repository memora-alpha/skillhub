import { notFound } from "next/navigation";
import { AdminLearningPathDetail } from "@/components/staff/admin-learning-paths";
export default async function Page({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) notFound();
  return <AdminLearningPathDetail id={id} />;
}
