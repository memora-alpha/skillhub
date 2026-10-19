import { useRouter } from "expo-router";
import { FeaturePage } from "@/components/feature-page";
import { EmptyState } from "@/components/EmptyState";

export function ProposalUnavailable() {
  const router = useRouter();
  return (
    <FeaturePage title="Đề xuất không khả dụng" back="/proposals" demo={false}>
      <EmptyState
        title="Không thể mở đề xuất"
        description="Mở một đề xuất từ danh sách, hoặc chọn yêu cầu học/kỹ năng công khai để gửi lời mời."
        action="Xem đề xuất"
        onAction={() => router.dismissTo("/proposals")}
      />
    </FeaturePage>
  );
}
