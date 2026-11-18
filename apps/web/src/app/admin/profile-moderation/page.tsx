import { ContentModerationScreen } from "@/components/staff/content-moderation";
import { adminModerationView } from "@/lib/staff/admin-navigation";
export default async function Page({
  searchParams,
}: Readonly<{ searchParams: Promise<{ userId?: string; view?: string }> }>) {
  const { userId, view } = await searchParams;
  const initialUserId =
    typeof userId === "string" &&
    /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(userId)
      ? userId
      : undefined;
  const initialView = adminModerationView(view, initialUserId);
  return (
    <ContentModerationScreen
      key={`${initialView}:${initialUserId ?? ""}`}
      initialUserId={initialUserId}
      initialView={initialView}
    />
  );
}
