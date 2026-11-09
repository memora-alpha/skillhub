import { FlowSection as Panel } from "@/components/learning-flow";
import { RouteButton } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { ConfirmedFormFeedback } from "@/features/messages/state";
import type { ApiLearningPath } from "../api/learning-paths-contract";
import { agreementProgress } from "../utils/progression";

function lockedScheduleNotice(
  path: ApiLearningPath,
  userId?: string,
): {
  title: string;
  description: string;
  tone: "warning" | "info" | "success";
} {
  const progress = agreementProgress(path, userId);
  const tone = path.status === "DISPUTED" ? "warning" : "info";
  if (
    path.terminationApprovedAt &&
    !["CANCELLED", "COMPLETED"].includes(path.status)
  )
    return {
      title: "Đã duyệt hủy lộ trình",
      description:
        "Các buổi học tương lai đã dừng. Credit được quyết toán khi đủ điều kiện.",
      tone,
    };
  if (progress.stage === "closed")
    return { title: progress.title, description: progress.description, tone };
  return {
    title: "Lịch đã chốt",
    description:
      "Lịch học đã được chốt. Mở danh sách để xem trạng thái từng buổi.",
    tone: "success",
  };
}

export function LockedScheduleSummary({
  path,
  userId,
  embedded,
}: Readonly<{
  path: ApiLearningPath;
  userId?: string;
  embedded: boolean;
}>) {
  const notice = lockedScheduleNotice(path, userId);
  return (
    <Panel title={notice.title}>
      <FormNotice tone={notice.tone} compact>
        {notice.description}
      </FormNotice>
      {!embedded && (
        <RouteButton href={`/paths/${path.id}/sessions`}>
          Xem tất cả buổi học
        </RouteButton>
      )}
      {!embedded && (
        <ConfirmedFormFeedback conversationId={path.conversationId} />
      )}
    </Panel>
  );
}
