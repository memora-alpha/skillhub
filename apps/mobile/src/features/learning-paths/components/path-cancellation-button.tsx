import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { useConnections } from "@/features/connections";
import type { ApiLearningPath } from "../api/learning-paths-contract";
import { useTerminationRequests } from "../hooks/use-path-changes";
import {
  openTermination,
  terminationSessionsCompleted,
} from "../utils/termination-policy";

export function PathCancellationButton({
  path,
}: Readonly<{
  path: ApiLearningPath;
}>) {
  const router = useRouter();
  const runtime = useConnections();
  const query = useTerminationRequests(path.id, path.status !== "CANCELLED");
  const request = query.denied ? undefined : query.data?.find(openTermination);
  const approved = !!path.terminationApprovedAt || !!request?.approvedAt;
  let label = "Hủy lộ trình";
  const completed = terminationSessionsCompleted(path);
  if (completed) label = "Xem lịch sử yêu cầu hủy";
  if (request)
    label =
      request.requesterId === runtime.userId
        ? "Đã gửi yêu cầu hủy"
        : "Xem yêu cầu hủy";
  if (approved) label = "Đã duyệt hủy · Xem Credit";
  if (path.status === "CANCELLED") label = "Chi tiết hủy lộ trình";
  return (
    <Button
      variant={
        approved || request || completed || path.status === "CANCELLED"
          ? "paper"
          : "danger"
      }
      onPress={() => router.push(`/paths/${path.id}/cancel`)}
    >
      {label}
    </Button>
  );
}
