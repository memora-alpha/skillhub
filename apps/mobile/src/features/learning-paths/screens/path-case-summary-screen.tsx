import { useLocalSearchParams } from "expo-router";
import { FlowPage } from "@/components/learning-flow";
import { Copy, RouteButton } from "@/components/feature-page";
import { EmptyState } from "@/components/EmptyState";
import { uuid } from "@/lib/http/contracts";
import { usePathCaseSummary } from "../hooks/use-path-overview";
import { ParticipantCaseCard } from "../components/participant-case-card";
import { PathReadFeedback } from "../components/PathReadFeedback";
import { waitingOnLabels } from "../utils/path-overview-presentation";

export function PathCaseSummaryScreen() {
  const params = useLocalSearchParams<{ id: string; caseId: string }>();
  const pathId = typeof params.id === "string" ? params.id : "";
  const caseId = typeof params.caseId === "string" ? params.caseId : "";
  const valid =
    uuid.safeParse(pathId).success && uuid.safeParse(caseId).success;
  const query = usePathCaseSummary(pathId, caseId);
  return (
    <FlowPage
      title="Tóm tắt vụ việc"
      back={valid ? `/paths/${pathId}/cases` : "/my-learning?tab=paths"}
      backBehavior="history"
      refreshing={query.isFetching}
      onRefresh={() => {
        void query.refetch({ cancelRefetch: false });
      }}
    >
      <PathReadFeedback query={query} />
      {!valid && (
        <EmptyState
          title="Mã vụ việc không hợp lệ"
          description="Mở lại từ thỏa thuận học."
        />
      )}
      {query.data && (
        <>
          <ParticipantCaseCard item={query.data} detail />
          <RouteButton
            secondary
            href={{
              pathname: "/reports/[id]",
              params: { id: caseId, support: "1", pathId },
            }}
          >
            Trao đổi với người xử lý
          </RouteButton>
          {query.data.attention && (
            <Copy>
              {waitingOnLabels[query.data.attention.waitingOn] ??
                "Đang xác minh bên cần xử lý"}
            </Copy>
          )}
          {query.data.status === "NEED_MORE_INFO" && (
            <Copy muted size="hint">
              Mở trao đổi riêng để xem phản hồi và bổ sung thông tin của bạn.
            </Copy>
          )}
          {query.data.status === "NEED_MORE_INFO" && (
            <RouteButton secondary href="/help">
              Trợ giúp
            </RouteButton>
          )}
        </>
      )}
    </FlowPage>
  );
}
