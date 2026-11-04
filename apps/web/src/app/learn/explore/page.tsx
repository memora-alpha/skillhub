import { PostFeed } from "@/features/learner/posts/post-feed";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const keyword = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 120) ?? "";
  return <PostFeed key={keyword} initialKeyword={keyword} />;
}
