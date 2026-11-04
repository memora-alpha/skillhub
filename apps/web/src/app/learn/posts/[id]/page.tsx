import { PostDetail } from "@/features/learner/posts/post-detail";
export default async function Page({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return <PostDetail key={id} id={id} />;
}
