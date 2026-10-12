import { DisputeDetail } from "@/components/console/disputes";

export default async function AdminDisputePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DisputeDetail id={id} base="/admin" />;
}
