import { useLocalSearchParams } from "expo-router";
import { uuid } from "@/lib/http/contracts";
import { EmptyState } from "@/components/EmptyState";
import { FeaturePage } from "@/components/feature-page";
import { ApiAttachmentScreen } from "./ApiAttachmentScreen";

export function AttachmentScreen() {
  const { proposalId } = useLocalSearchParams<{ proposalId?: string }>();
  if (uuid.safeParse(proposalId).success)
    return <ApiAttachmentScreen id={proposalId!} />;
  return (
    <FeaturePage title="Gửi tệp trong chat" back="/messages" demo={false}>
      <EmptyState
        title="Không tìm thấy cuộc trao đổi"
        description="Mở một cuộc trò chuyện hợp lệ trước khi gửi tệp."
      />
    </FeaturePage>
  );
}
