import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { FlowPage } from "@/components/learning-flow";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useConnections } from "@/features/connections";
import { Copy, RouteButton } from "@/components/feature-page";
import { uuid } from "@/lib/http/contracts";
import { PathReadFeedback } from "../components/PathReadFeedback";
import { TerminationCreateForm } from "../components/termination-create-form";
import { TerminationRequestCard } from "../components/termination-request-card";
import { TerminationCreditPreview } from "../components/termination-credit-preview";
import { useLearningPath } from "../hooks/use-learning-paths-api";
import {
  usePathSettlement,
  useTerminationRequests,
} from "../hooks/use-path-changes";
import { usePullRefresh } from "../hooks/use-pull-refresh";
import { canRequestTermination } from "../utils/termination-policy";

export function PathCancellationScreen() {
  const { id = "", changeRequestId } = useLocalSearchParams<{
    id?: string;
    changeRequestId?: string;
  }>();
  const runtime = useConnections();
  return (
    <CancellationContent
      key={JSON.stringify([runtime.key, id])}
      id={id}
      changeRequestId={changeRequestId}
    />
  );
}

function CancellationContent({
  id,
  changeRequestId,
}: Readonly<{ id: string; changeRequestId?: string }>) {
  const runtime = useConnections();
  const cache = useQueryClient();
  const path = useLearningPath(id);
  const query = useTerminationRequests(id, !!path.data && !path.denied);
  // Keep terminal financial read invalidation without a second settlement card.
  usePathSettlement(id, !!path.data && !path.denied);
  const refresh = async () => {
    const latest = await path.refetch({ cancelRefetch: false });
    if (runtime.isCurrent() && latest.data && !latest.error) {
      await query.refetch({ cancelRefetch: false });
      if (runtime.isCurrent())
        await cache.invalidateQueries(
          {
            queryKey: [
              ...runtime.key,
              "learning-paths",
              id,
              "termination-quote",
            ],
            exact: true,
          },
          { cancelRefetch: false },
        );
    }
  };
  const pull = usePullRefresh(refresh);
  const blocked =
    !!path.error || !!query.error || path.isFetching || query.isFetching;
  return (
    <FlowPage
      title="Hủy lộ trình"
      demo={false}
      back={
        uuid.safeParse(id).success ? `/paths/${id}` : "/my-learning?tab=paths"
      }
      refreshing={pull.refreshing}
      onRefresh={uuid.safeParse(id).success ? pull.onRefresh : undefined}
    >
      {!uuid.safeParse(id).success && (
        <EmptyState
          title="Không tìm thấy lộ trình"
          description="Mở một lộ trình hợp lệ từ danh sách của bạn."
        />
      )}
      <PathReadFeedback query={path} />
      {path.data && (
        <>
          <PathReadFeedback query={query} />
          {!query.data && !query.error && !query.isLoading && (
            <EmptyState
              title="Chưa tải được yêu cầu dừng"
              description="Kết nối mạng rồi kéo xuống để tải lại."
            />
          )}
          {query.data && (
            <>
              {uuid.safeParse(changeRequestId).success &&
                !query.data.some(
                  (request) => request.id === changeRequestId,
                ) && (
                  <>
                    <FormNotice tone="info" compact>
                      Không tìm thấy yêu cầu hủy lộ trình. Kiểm tra các buổi học
                      nếu đây là thông báo hủy buổi.
                    </FormNotice>
                    <RouteButton secondary href={`/paths/${id}/sessions`}>
                      Xem các buổi học của lộ trình
                    </RouteButton>
                  </>
                )}
              {canRequestTermination(path.data, query.data) && (
                <TerminationCreateForm
                  pathId={id}
                  blocked={blocked}
                  refresh={refresh}
                />
              )}
              {!query.data.length &&
                !canRequestTermination(path.data, query.data) && (
                  <FormNotice tone="info" compact>
                    Lộ trình hiện chưa đủ điều kiện gửi yêu cầu hủy.
                  </FormNotice>
                )}
              {[
                ...query.data.filter(
                  (request) => request.id === changeRequestId,
                ),
                ...query.data.filter(
                  (request) => request.id !== changeRequestId,
                ),
              ].map((request) => (
                <TerminationRequestCard
                  key={`${request.id}:${request.version}`}
                  request={request}
                  blocked={blocked}
                  refresh={refresh}
                />
              ))}
              {path.data.lockedVersion !== null &&
                !path.data.settledAt &&
                ["SCHEDULED", "ACTIVE", "DISPUTED"].includes(
                  path.data.status,
                ) && <TerminationCreditPreview pathId={id} />}
              {query.data.length === 100 && (
                <Copy size="hint">
                  Hiển thị tối đa 100 yêu cầu gần nhất do hệ thống cung cấp.
                </Copy>
              )}
            </>
          )}
        </>
      )}
    </FlowPage>
  );
}
