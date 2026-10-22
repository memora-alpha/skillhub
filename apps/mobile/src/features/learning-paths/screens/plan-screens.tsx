import { useLocalSearchParams } from "expo-router";
import { EmptyState } from "@/components/EmptyState";
import { FeaturePage } from "@/components/feature-page";
import { uuid } from "@/lib/http/contracts";
import { ApiPlanDetailScreen, ApiPlanEditorScreen } from "./ApiPlanScreens";

export function PlanDetailScreen() {
  const { id, planId } = useLocalSearchParams<{
    id?: string;
    planId?: string;
  }>();
  if (uuid.safeParse(id).success && uuid.safeParse(planId).success)
    return <ApiPlanDetailScreen />;
  return (
    <FeaturePage title="Chi tiết lộ trình" demo={false}>
      <EmptyState
        title="Không tìm thấy lộ trình"
        description="Mở một lộ trình hợp lệ từ thỏa thuận của bạn."
      />
    </FeaturePage>
  );
}

export function PlanEditorScreen() {
  const { id, planId } = useLocalSearchParams<{
    id?: string;
    planId?: string;
  }>();
  if (
    uuid.safeParse(id).success &&
    (planId === undefined || uuid.safeParse(planId).success)
  )
    return <ApiPlanEditorScreen />;
  return (
    <FeaturePage title="Chỉnh sửa lộ trình" demo={false}>
      <EmptyState
        title="Không tìm thấy lộ trình"
        description="Mở tạo hoặc chỉnh sửa từ một thỏa thuận hợp lệ."
      />
    </FeaturePage>
  );
}
