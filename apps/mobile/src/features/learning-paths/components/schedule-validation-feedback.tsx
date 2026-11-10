import { Text, View } from "react-native";
import { fonts } from "@/constants/theme";
import { FormNotice } from "@/components/FormNotice";
import { Copy, RouteButton } from "@/components/feature-page";
import { useCatalogName, useParticipantName } from "@/features/connections";
import type { ApiLearningPath } from "../api/learning-paths-contract";
import { invalidScheduleDetails } from "@/lib/http/scheduling-error";
import {
  invalidScheduleItems,
  serverInvalidScheduleItems,
} from "../utils/invalid-schedule-items";
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
  const skill = useCatalogName(issue.plan.skillId);
  const teacherLabel =
    teacher.data || (issue.plan.teacherId === userId ? "bạn" : "đối tác");
  const mine = issue.plan.teacherId === userId;
  return (
    <View style={{ gap: 8 }}>
      {issue.items.map((item) => (
        <FormNotice key={item.sessionNo} tone="error" compact>
          <Text style={{ fontFamily: fonts.semibold }}>
            Buổi {item.sessionNo}: {item.reasons.join("; ")}.
          </Text>
          {`\n${skill.data ? `${skill.data} · ` : ""}${teacherLabel} dạy`}
          {Number.isFinite(Date.parse(item.startAt)) &&
          Number.isFinite(Date.parse(item.endAt))
            ? `\n${scheduleWindowLabel(item)}`
            : ""}
        </FormNotice>
      ))}
      <Copy size="hint">
        {mine
          ? "Vui lòng chọn thời gian mới cho các buổi cần sửa."
          : "Vui lòng nhờ đối tác sửa thời gian của các buổi trên."}
      </Copy>
      <RouteButton
        secondary
        href={
          issue.plan.teacherId === userId
            ? `/paths/${pathId}/schedules/${issue.plan.id}`
            : `/paths/${pathId}/schedules`
        }
      >
        {mine ? "Sửa lịch của bạn" : "Xem lịch cần sửa"}
      </RouteButton>
    </View>
  );
}

export function ScheduleValidationFeedback({
  path,
  userId,
  error,
  snapshotCurrent = true,
}: Readonly<{
  path: ApiLearningPath;
  userId?: string;
  error?: unknown;
  snapshotCurrent?: boolean;
}>) {
  const details = invalidScheduleDetails(error);
  const issues = snapshotCurrent
    ? details
      ? serverInvalidScheduleItems(path, details)
      : invalidScheduleItems(path)
    : undefined;
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: 12 }}>
      <Copy>Chưa thể chốt lịch.</Copy>
      {!issues ? (
        <FormNotice tone="error" compact>
          Lịch đã thay đổi. Hãy tải lại và kiểm tra lịch mới.
        </FormNotice>
      ) : issues.length ? (
        <>
          {!details && (
            <Copy size="hint">
              Chưa có kết quả kiểm tra chi tiết. Hãy tải lại lịch để kiểm tra
              các buổi dưới đây.
            </Copy>
          )}
          {issues.map((issue) => (
            <InvalidPlanSchedule
              key={issue.plan.id}
              pathId={path.id}
              issue={issue}
              userId={userId}
            />
          ))}
        </>
      ) : (
        <FormNotice tone="error" compact>
          Chưa xác định được buổi cần sửa. Hãy tải lại lịch và kiểm tra lại.
        </FormNotice>
      )}
    </View>
  );
}
