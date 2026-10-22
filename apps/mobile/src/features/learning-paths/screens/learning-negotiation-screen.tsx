import { useConnections, ConnectionFeedback } from "@/features/connections";
import { useConversation } from "@/features/messages";
import { FlowPage } from "@/components/learning-flow";
import { Copy } from "@/components/feature-page";
import { EmptyState } from "@/components/EmptyState";
import { uuid } from "@/lib/http/contracts";
import { ApiAgreementEntry } from "../components/ApiAgreementEntry";
import { usePullRefresh } from "../hooks/use-pull-refresh";

export function LearningNegotiationScreen({
  conversationId,
}: Readonly<{ conversationId: string }>) {
  const query = useConversation(conversationId);
  const pullRefresh = usePullRefresh(query.refetch);
  const runtime = useConnections();
  const valid = uuid.safeParse(conversationId).success;
  return (
    <FlowPage
      title="Thỏa thuận học"
      backBehavior="history"
      back={
        valid
          ? {
              pathname: "/chat/[proposalId]",
              params: { proposalId: conversationId, mode: "api" },
            }
          : "/messages"
      }
      refreshing={pullRefresh.refreshing}
      onRefresh={pullRefresh.onRefresh}
    >
      {!valid ? (
        <EmptyState
          title="Chọn cuộc trò chuyện"
          description="Mở lộ trình từ cuộc trò chuyện của bạn."
        />
      ) : (
        <>
          <ConnectionFeedback
            loading={query.isLoading}
            error={query.error}
            retry={query.refetch}
          />
          {query.data && (
            <>
              <Copy muted>
                Cùng thống nhất nội dung học trước khi chọn lịch.
              </Copy>
              <ApiAgreementEntry
                key={`${runtime.key.join(":")}:${conversationId}`}
                conversationId={conversationId}
                participantAId={query.data.participantAId}
                participantBId={query.data.participantBId}
                blocked={!!query.error}
              />
            </>
          )}
        </>
      )}
    </FlowPage>
  );
}
