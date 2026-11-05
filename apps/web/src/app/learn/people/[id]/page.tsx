import { notFound } from "next/navigation";
import { PublicProfileScreen } from "@/features/learner/discovery/public-profile-screen";

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    notFound();
  return <PublicProfileScreen key={id} userId={id} />;
}
