import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { useConnections } from "@/features/connections";
import type { ApiLearningPath } from "@/features/learning-paths";
import { usePathReviews } from "../hooks/use-community";
import { teacherReviewPlan } from "../utils/teacher-review";

export function PathReviewAction({
  path,
}: Readonly<{ path: ApiLearningPath }>) {
  const runtime = useConnections();
  const router = useRouter();
  const counterpartId =
    path.participantAId === runtime.userId
      ? path.participantBId
      : path.participantAId;
  const eligible = path.status === "COMPLETED" && path.settledAt !== null;
  const reviews = usePathReviews(path.id, counterpartId, eligible);
  if (!eligible) return null;
  const own = reviews.data?.some((row) => row.reviewerId === runtime.userId);
  const canWrite =
    teacherReviewPlan(path, runtime.userId) &&
    !own &&
    !!reviews.data &&
    !reviews.error &&
    !reviews.denied &&
    !reviews.isFetching;
  let label = own ? "Xem đánh giá đã gửi" : "Xem đánh giá";
  if (canWrite) label = "Đánh giá người dạy";
  return (
    <Button
      variant={canWrite ? "craft" : "paper"}
      leadingIcon={canWrite ? "star" : "message"}
      onPress={() => router.push(`/paths/${path.id}/review`)}
    >
      {label}
    </Button>
  );
}
