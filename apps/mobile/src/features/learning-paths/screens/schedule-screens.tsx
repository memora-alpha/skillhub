import { useLocalSearchParams } from "expo-router";
import { EmptyState } from "@/components/EmptyState";
import { FeaturePage } from "@/components/feature-page";
import { FlowRedirect } from "@/components/learning-flow";
import { uuid } from "@/lib/http/contracts";
import {
  ApiSchedulesScreen,
  ApiScheduleEditorScreen,
} from "./ApiScheduleScreens";

export function SchedulesScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (uuid.safeParse(id).success) return <ApiSchedulesScreen />;
  return (
    <FeaturePage title="Lịch của từng kế hoạch" demo={false}>
      <EmptyState
        title="Không tìm thấy lộ trình"
        description="Mở lịch từ một lộ trình hợp lệ trong thỏa thuận."
      />
    </FeaturePage>
  );
}

export function ScheduleEditorScreen() {
  const { id, planId } = useLocalSearchParams<{
    id?: string;
    planId?: string;
  }>();
  if (uuid.safeParse(id).success && uuid.safeParse(planId).success)
    return <ApiScheduleEditorScreen />;
  return (
    <FeaturePage title="Đề xuất lịch tôi dạy" demo={false}>
      <EmptyState
        title="Không tìm thấy kế hoạch"
        description="Mở lịch từ một kế hoạch học hợp lệ."
      />
    </FeaturePage>
  );
}

export function HoldScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (uuid.safeParse(id).success)
    return <FlowRedirect href={`/paths/${id}/schedules`} />;
  return (
    <FeaturePage title="Kiểm tra & chốt lịch" demo={false}>
      <EmptyState
        title="Không tìm thấy lộ trình"
        description="Mở bước chốt lịch từ một thỏa thuận hợp lệ."
      />
    </FeaturePage>
  );
}
