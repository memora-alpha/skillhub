import { View } from "react-native";
import { FormNotice } from "@/components/FormNotice";
import { Copy, RouteButton } from "@/components/feature-page";
import { useCatalogName, useParticipantName } from "@/features/connections";
import type { ApiLearningPath } from "../api/learning-paths-contract";
import { invalidScheduleItems } from "../utils/invalid-schedule-items";
import { scheduleWindowLabel } from "../utils/schedule-conflicts";

function InvalidPlanSchedule({
  pathId,
  issue,
  userId,
}: Readonly<{
  pathId: string;
  issue: ReturnType<typeof invalidScheduleItems>[number];
  userId?: string;
}>) {
  const teacher = useParticipantName(issue.plan.teacherId);
  const learner = useParticipantName(issue.plan.learnerId);
  const skill = useCatalogName(issue.plan.skillId);
  const teacherLabel =
    teacher.data || (issue.plan.teacherId === userId ? "bạn" : "đối tác");
  const learnerLabel =
    learner.data || (issue.plan.learnerId === userId ? "bạn" : "đối tác");
  return (
    <View style={{ gap: 8 }}>
      <FormNotice tone="error" compact>
        Lịch do {teacherLabel} dạy, {learnerLabel} học
        {skill.data ? ` · ${skill.data}` : ""}:
        {issue.items
          .map((item) => {
            const validDates =
              Number.isFinite(Date.parse(item.startAt)) &&
              Number.isFinite(Date.parse(item.endAt));
            return `\nBuổi ${item.sessionNo}${validDates ? ` (${scheduleWindowLabel(item)} · giờ thiết bị)` : ""}: ${item.reasons.join("; ")}.`;
          })
          .join("")}
      </FormNotice>
      <RouteButton
        secondary
        href={
          issue.plan.teacherId === userId
            ? `/paths/${pathId}/schedules/${issue.plan.id}`
            : `/paths/${pathId}/schedules`
        }
      >
        {issue.plan.teacherId === userId
          ? "Sửa lịch bạn dạy"
          : "Xem lịch và nhờ đối tác sửa"}
      </RouteButton>
    </View>
  );
}

export function ScheduleValidationFeedback({
  path,
  userId,
}: Readonly<{
  path: ApiLearningPath;
  userId?: string;
}>) {
  const issues = invalidScheduleItems(path);
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: 12 }}>
      <Copy>Chưa thể chốt lịch vì thời gian không hợp lệ.</Copy>
      {issues.length ? (
        issues.map((issue) => (
          <InvalidPlanSchedule
            key={issue.plan.id}
            pathId={path.id}
            issue={issue}
            userId={userId}
          />
        ))
      ) : (
        <FormNotice tone="error" compact>
          Máy chủ chưa trả chi tiết lịch của ai hoặc buổi nào không hợp lệ. Hãy
          tải lại lộ trình và kiểm tra ngày giờ từng lịch; giờ bắt đầu phải ở
          tương lai và thời lượng từ 60 đến 180 phút.
        </FormNotice>
      )}
    </View>
  );
}
