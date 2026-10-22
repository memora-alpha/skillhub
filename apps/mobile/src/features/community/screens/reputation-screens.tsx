import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { ConnectionFeedback } from "@/features/connections";
import { useReputation } from "../hooks/use-community";
import {
  ReputationSummary,
  reputationReasons,
} from "../components/reputation-summary";

export function ReputationScreen() {
  return <ReputationView history={false} />;
}
export function ReputationHistoryScreen() {
  return <ReputationView history />;
}
function ReputationView({ history }: Readonly<{ history: boolean }>) {
  const query = useReputation();
  const data = query.data?.pages[0];
  return (
    <FeaturePage
      title={history ? "Lịch sử uy tín" : "Điểm uy tín"}
      back={history ? "/reputation" : "/profile"}
      demo={false}
    >
      <Button
        variant="paper"
        disabled={query.isFetching}
        onPress={() => void query.refetch()}
      >
        {query.isFetching ? "Đang cập nhật…" : "Làm mới uy tín"}
      </Button>
      <ConnectionFeedback loading={query.isLoading} error={query.error} />
      {query.denied && (
        <Copy>Thông tin uy tín hiện không khả dụng cho tài khoản này.</Copy>
      )}
      {data && <ReputationSummary data={data} />}
      {data && history && (
        <>
          {!query.items.length && (
            <EmptyState
              title="Chưa có thay đổi điểm"
              description="Lịch sử sẽ xuất hiện khi hệ thống ghi nhận thay đổi uy tín."
            />
          )}
          {query.items.map((row) => (
            <Panel
              key={row.id}
              title={reputationReasons[row.reasonCode] ?? row.reasonCode}
            >
              <Copy>
                {row.delta > 0 ? "+" : ""}
                {row.delta} điểm · {row.scoreBefore} → {row.scoreAfter}
              </Copy>
              <Copy muted>
                {new Date(row.createdAt).toLocaleString("vi-VN")}
              </Copy>
            </Panel>
          ))}
          {query.hasNextPage && (
            <Button
              variant="paper"
              disabled={query.isFetching}
              onPress={() => void query.fetchNextPage()}
            >
              Xem thêm lịch sử
            </Button>
          )}
        </>
      )}
      {!history && (
        <RouteButton secondary href="/reputation/history">
          Lịch sử điểm & vi phạm
        </RouteButton>
      )}
      <RouteButton secondary href="/achievements">
        Xem danh hiệu
      </RouteButton>
      <RouteButton secondary href="/reports">
        Báo cáo của tôi
      </RouteButton>
    </FeaturePage>
  );
}
