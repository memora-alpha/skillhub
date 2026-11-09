import { PathReviewScreen } from "@/features/learner/reviews/path-review-screen";

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <PathReviewScreen key={id} id={id} />;
}
