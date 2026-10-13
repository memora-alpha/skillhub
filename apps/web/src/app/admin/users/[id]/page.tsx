import { UsersScreen } from "@/components/staff/users";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <UsersScreen initialUserId={id} />;
}
