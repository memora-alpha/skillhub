import { PathReadFeedback } from "../components/PathReadFeedback";
import { useLocalSearchParams } from "expo-router";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { Button } from "@/components/Button";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionCommand,
  useCatalogName,
  useParticipantName,
} from "@/features/connections";
import {
  useLearningPath,
  useLearningPathsApi,
} from "../hooks/use-learning-paths-api";
import {
  canCreatePlan,
  canConfirmPlan,
  editablePath,
  ownConfirmation,
  pathStatusLabel,
} from "../policy-api";
import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";

export function ApiPathDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useLearningPath(id);
  return (
    <FeaturePage
      title="Không gian lộ trình"
      demo={false}
      back="/my-learning?tab=paths"
    >
      <PathReadFeedback query={query} />
      {query.data && (
        <PathContent
          path={query.data}
          blocked={!!query.error || query.isFetching}
        />
      )}
    </FeaturePage>
  );
}
function PathContent({
  path,
  blocked,
}: Readonly<{
  path: ApiLearningPath;
  blocked: boolean;
}>) {
  const runtime = useConnections(),
    api = useLearningPathsApi(),
    command = useConnectionCommand();
  const name = useParticipantName(
    path.participantAId === runtime.userId
      ? path.participantBId
      : path.participantAId,
  );
  const a = path.agreement,
    confirmed = !!ownConfirmation(path, a, runtime.userId);
  const partnerConfirmedAt =
    path.participantAId === runtime.userId
      ? a.participantBConfirmedAt
      : a.participantAConfirmedAt;
  return (
    <>
      <Panel title={`Cùng ${name.data ?? "đối tác"}`} accent>
        <Copy>
          {pathStatusLabel[path.status]} · v{path.currentVersion}
        </Copy>
        <Copy>
          {a.exchangeType === "TWO_WAY"
            ? `Trao đổi hai chiều · ${a.totalCreditPerUser} CR cam kết mỗi người`
            : `Học một chiều · ${a.negotiatedCredit} CR toàn lộ trình`}
        </Copy>
        {path.lockedVersion !== null && (
          <Copy>
            Đã khóa phiên bản {path.lockedVersion}. Các buổi học bên dưới được
            tải từ hệ thống.
          </Copy>
        )}
      </Panel>
      {path.plans.map((plan) => (
        <ApiPlanPanel key={plan.id} path={path} plan={plan} blocked={blocked} />
      ))}
      {canCreatePlan(path, runtime.userId) && !blocked && (
        <RouteButton href={`/paths/${path.id}/plans/new`}>
          Tạo kế hoạch tôi dạy
        </RouteButton>
      )}
      {path.plans.length < (a.exchangeType === "TWO_WAY" ? 2 : 1) && (
        <Copy muted>Mỗi người dạy tự tạo kế hoạch cho chiều mình dạy.</Copy>
      )}
      <Panel title="Điều khoản chung">
        <Copy>
          Bạn: {confirmed ? "đã xác nhận" : "chưa xác nhận"} · Đối tác:{" "}
          {partnerConfirmedAt ? "đã xác nhận" : "chưa xác nhận"}
        </Copy>
        <Copy muted>
          Điều khoản và từng kế hoạch có xác nhận riêng. Tin nhắn không thay thế
          xác nhận.
        </Copy>
        {editablePath(path) && (
          <Button
            disabled={blocked || command.pending || confirmed}
            onPress={() => {
              void command.run(
                `agreement:${path.id}:${path.currentVersion}`,
                () => api.confirm(path.id, path.currentVersion),
              );
            }}
          >
            {confirmed
              ? "Bạn đã xác nhận"
              : `Xác nhận điều khoản v${path.currentVersion}`}
          </Button>
        )}
        <ConnectionFeedback error={command.error} />
        {editablePath(path) && !blocked && (
          <RouteButton secondary href={`/paths/${path.id}/terms`}>
            Điều chỉnh điều khoản
          </RouteButton>
        )}
      </Panel>
      <RouteButton href={`/paths/${path.id}/schedules`}>
        Lịch của từng kế hoạch
      </RouteButton>
      {editablePath(path) && (
        <RouteButton secondary href={`/paths/${path.id}/hold`}>
          Kiểm tra và chốt lịch
        </RouteButton>
      )}
      <RouteButton secondary href={`/chat/${path.conversationId}`}>
        Trao đổi qua Chat
      </RouteButton>
    </>
  );
}
export function ApiPlanPanel({
  path,
  plan,
  blocked = false,
}: Readonly<{
  path: ApiLearningPath;
  plan: ApiLearningPlan;
  blocked?: boolean;
}>) {
  const runtime = useConnections(),
    api = useLearningPathsApi(),
    command = useConnectionCommand();
  const skill = useCatalogName(plan.skillId);
  return (
    <Panel title={`${skill.data ?? "Kế hoạch học"} · v${plan.version}`}>
      <Copy>
        {plan.teacherId === runtime.userId
          ? "Bạn dạy → đối tác học"
          : "Đối tác dạy → bạn học"}{" "}
        · {plan.totalSessions} buổi
      </Copy>
      <Copy>{plan.learningGoal}</Copy>
      {plan.sessionOutline.map((s) => (
        <Copy key={s.sessionNo}>
          Buổi {s.sessionNo}: {s.content}
        </Copy>
      ))}
      <Copy muted>
        {plan.learnerConfirmedAt
          ? "Người học đã xác nhận phiên bản này."
          : "Chờ người học xác nhận phiên bản này."}
      </Copy>
      {canConfirmPlan(path, plan, runtime.userId) && (
        <Button
          disabled={blocked || command.pending}
          onPress={() => {
            void command.run(`plan:${plan.id}:${plan.version}`, () =>
              api.confirmPlan(plan.id, plan.version),
            );
          }}
        >
          Xác nhận kế hoạch v{plan.version}
        </Button>
      )}
      <ConnectionFeedback error={command.error} />
      {editablePath(path) && plan.teacherId === runtime.userId && !blocked && (
        <RouteButton secondary href={`/paths/${path.id}/plans/${plan.id}/edit`}>
          Sửa kế hoạch tôi dạy
        </RouteButton>
      )}
    </Panel>
  );
}
