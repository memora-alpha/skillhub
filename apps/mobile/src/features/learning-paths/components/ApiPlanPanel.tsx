import { Copy, Panel, RouteButton } from "@/components/feature-page";
import { Button } from "@/components/Button";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionCommand,
  useCatalogName,
} from "@/features/connections";
import { useLearningPathsApi } from "../hooks/use-learning-paths-api";
import { canConfirmPlan, editablePath } from "../utils/policy-api";
import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";

export function ApiPlanPanel({
  path,
  plan,
  blocked = false,
  compact = false,
}: Readonly<{
  path: ApiLearningPath;
  plan: ApiLearningPlan;
  blocked?: boolean;
  compact?: boolean;
}>) {
  const runtime = useConnections(),
    api = useLearningPathsApi(),
    command = useConnectionCommand([
      ["learning-paths", path.id],
      ["learning-paths", "mine"],
    ]);
  const skill = useCatalogName(plan.skillId);
  const teaches = plan.teacherId === runtime.userId;
  let confirmation = teaches
    ? "Đang chờ người trao đổi xem và đồng ý nội dung bạn dạy."
    : "Bạn cần xem và đồng ý nội dung người trao đổi sẽ dạy.";
  if (plan.learnerConfirmedAt)
    confirmation = "Người học đã đồng ý nội dung này.";
  return (
    <Panel
      title={`${teaches ? "Bạn dạy" : "Bạn học"} · ${skill.data ?? "Kỹ năng"}`}
    >
      <Copy>
        {plan.totalSessions} buổi · {plan.learningGoal}
      </Copy>
      <Copy muted>{confirmation}</Copy>
      {compact ? (
        <RouteButton secondary href={`/paths/${path.id}/plans/${plan.id}`}>
          Xem nội dung từng buổi
        </RouteButton>
      ) : (
        <>
          {plan.sessionOutline.map((s) => (
            <Copy key={s.sessionNo}>
              Buổi {s.sessionNo}: {s.content}
            </Copy>
          ))}
          {canConfirmPlan(path, plan, runtime.userId) && (
            <Button
              disabled={blocked || command.pending || command.uncertain}
              onPress={() => {
                if (!blocked && !command.pending && !command.uncertain)
                  void command.run(`plan:${plan.id}:${plan.version}`, () =>
                    api.confirmPlan(plan.id, plan.version),
                  );
              }}
            >
              Tôi đồng ý nội dung sẽ học
            </Button>
          )}
          {editablePath(path) && teaches && !blocked && (
            <RouteButton
              secondary
              href={`/paths/${path.id}/plans/${plan.id}/edit`}
            >
              Chỉnh nội dung bạn dạy
            </RouteButton>
          )}
          <ConnectionFeedback error={command.error} />
          {command.uncertain && (
            <Button
              variant="paper"
              disabled={command.pending}
              onPress={() => {
                void command.retry();
              }}
            >
              Kiểm tra lại lần xác nhận vừa gửi
            </Button>
          )}
          <RouteButton secondary href={`/paths/${path.id}`}>
            Về việc học để xem bước tiếp theo
          </RouteButton>
        </>
      )}
    </Panel>
  );
}
