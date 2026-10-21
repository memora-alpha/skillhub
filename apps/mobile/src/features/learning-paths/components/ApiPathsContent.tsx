import { PathReadFeedback } from "./PathReadFeedback";
import { EmptyState } from "@/components/EmptyState";
import { Copy, Panel, RouteButton } from "@/components/feature-page";
import { useParticipantName } from "@/features/connections";
import { useLearningPaths } from "../hooks/use-learning-paths-api";
import { pathStatusLabel } from "../policy-api";
import type { PathSummary } from "../api/learning-paths-contract";

export function ApiPathCard({ path }: Readonly<{ path: PathSummary }>) {
  const name = useParticipantName(path.counterpartId);
  const oneWayLabel =
    path.exchangeType === "ONE_WAY" ? "Học một chiều" : "Chưa có hình thức học";
  const exchangeLabel =
    path.exchangeType === "TWO_WAY" ? "Trao đổi hai chiều" : oneWayLabel;
  return (
    <Panel title={name.data ?? "Learning Path cùng người trao đổi"}>
      <Copy>{pathStatusLabel[path.status]}</Copy>
      <Copy>{exchangeLabel}</Copy>
      <RouteButton secondary href={`/paths/${path.id}`}>
        Tiếp tục việc học
      </RouteButton>
    </Panel>
  );
}
export function ApiPathsContent() {
  const query = useLearningPaths();
  return (
    <>
      <PathReadFeedback query={query} />
      {query.data?.map((path) => (
        <ApiPathCard key={path.id} path={path} />
      ))}
      {query.data?.length === 0 && (
        <EmptyState
          title="Chưa có Learning Path"
          description="Mở cuộc trò chuyện sau khi đề xuất được chấp nhận để cùng tạo Learning Path."
        />
      )}
      {query.data?.length === 100 && (
        <Copy muted>
          Đang hiển thị tối đa 100 Learning Path được cập nhật gần nhất.
        </Copy>
      )}
    </>
  );
}
