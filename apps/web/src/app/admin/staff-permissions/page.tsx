import { StaffPermissionsScreen } from "@/components/staff/staff-permissions";
export default async function Page({
  searchParams,
}: Readonly<{ searchParams: Promise<{ userId?: string }> }>) {
  const { userId } = await searchParams;
  const initialUserId =
    typeof userId === "string" &&
    /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(userId)
      ? userId
      : undefined;
  return <StaffPermissionsScreen initialUserId={initialUserId} />;
}
