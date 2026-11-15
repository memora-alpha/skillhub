import { AdminLearningPaths } from "@/components/staff/admin-learning-paths";
export default async function Page({
  searchParams,
}: Readonly<{ searchParams: Promise<{ status?: string }> }>) {
  const params = await searchParams;
  return <AdminLearningPaths initialStatus={params.status} />;
}
