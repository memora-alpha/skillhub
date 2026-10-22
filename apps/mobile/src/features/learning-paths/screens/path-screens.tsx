import { useLocalSearchParams } from "expo-router";
import { EmptyState } from "@/components/EmptyState";
import { FeaturePage } from "@/components/feature-page";
import { uuid } from "@/lib/http/contracts";
import { LearningNegotiationScreen } from "./learning-negotiation-screen";
import { ApiPathDetailScreen } from "./ApiPathDetailScreen";

export function AgreementTypeScreen() {
  const params = useLocalSearchParams<{
    conversationId?: string;
    proposalId?: string;
  }>();
  const conversationId = params.conversationId ?? params.proposalId ?? "";
  return <LearningNegotiationScreen conversationId={conversationId} />;
}

export function PathDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (uuid.safeParse(id).success) return <ApiPathDetailScreen />;
  return (
    <FeaturePage title="Thỏa thuận học" demo={false}>
      <EmptyState
        title="Không tìm thấy thỏa thuận"
        description="Mở một thỏa thuận hợp lệ từ cuộc trò chuyện của bạn."
      />
    </FeaturePage>
  );
}
