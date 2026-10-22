import { useLocalSearchParams } from "expo-router";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionCommand,
  useCatalogName,
} from "@/features/connections";
import {
  useLearningPath,
  useLearningPathsApi,
} from "../hooks/use-learning-paths-api";
import { useFinalValidation } from "../hooks/use-final-validation";
import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";
import { PathReadFeedback } from "../components/PathReadFeedback";
import {
  JourneyProgress,
  JourneyNextStep,
} from "../components/LearningJourney";
import { learningJourney } from "../journey";

export function ApiHoldScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useLearningPath(id);
  return (
    <FeaturePage
      title="Xem lại và chốt lịch"
      demo={false}
      back={`/paths/${id}`}
    >
      <JourneyProgress step={4} done={query.data?.lockedVersion != null} />
      {query.data && (
        <HoldContent
          path={query.data}
          blocked={!!query.error || query.isFetching}
          refresh={query.refetch}
        />
      )}
      <PathReadFeedback query={query} />
    </FeaturePage>
  );
}
function HoldContent({
  path,
  blocked,
  refresh,
}: Readonly<{
  path: ApiLearningPath;
  blocked: boolean;
  refresh: () => unknown;
}>) {
  const api = useLearningPathsApi(),
    runtime = useConnections();
  const check = useFinalValidation(path, blocked);
  const finalize = useConnectionCommand();
  const a = path.agreement;
  const learner =
    a.exchangeType === "ONE_WAY" && a.learnerId === runtime.userId;
  const amount =
    a.exchangeType === "TWO_WAY" ? a.totalCreditPerUser : a.negotiatedCredit;
  const holds = a.exchangeType === "TWO_WAY" || learner;
  const complete = path.lockedVersion !== null;
  let finalizeLabel = holds
    ? `Chốt lịch và tạm giữ ${amount} Credit`
    : "Chốt lịch · bạn không giữ Credit";
  if (finalize.pending) finalizeLabel = "Đang chốt lịch…";
  return (
    <>
      {finalize.uncertain && (
        <Panel title="Cần kiểm tra lần chốt vừa gửi">
          <Copy>
            Chưa nhận được kết quả rõ ràng. Kiểm tra lại cùng thao tác để tránh
            chốt hoặc giữ Credit hai lần.
          </Copy>
          <Button
            variant="paper"
            disabled={finalize.pending}
            onPress={() => {
              void finalize.retry().then((result) => {
                if (result) refresh();
              });
            }}
          >
            Kiểm tra lại lần chốt vừa gửi
          </Button>
        </Panel>
      )}
      {complete ? (
        <Panel title="Lịch học đã chốt" accent>
          <Copy>Các buổi học và khoản Credit đã được ghi nhận.</Copy>
          <RouteButton href={`/paths/${path.id}/schedules`}>
            Xem lịch đã chốt
          </RouteButton>
        </Panel>
      ) : (
        <>
          {!check.ready && (
            <JourneyNextStep
              journey={learningJourney(path, runtime.userId)}
              blocked={blocked}
            />
          )}
          <Panel title="Hai bạn đã thống nhất">
            <Copy>
              {a.exchangeType === "TWO_WAY"
                ? "Học kỹ năng của nhau"
                : "Một người dạy, một người học"}{" "}
              · {path.plans.reduce((sum, p) => sum + p.totalSessions, 0)} buổi
            </Copy>
            {path.plans.map((plan) => (
              <ReviewPlan key={plan.id} plan={plan} userId={runtime.userId} />
            ))}
            <RouteButton secondary href={`/paths/${path.id}/schedules`}>
              Xem lại chi tiết lịch
            </RouteButton>
          </Panel>
          <Panel title="Credit của bạn khi chốt" accent>
            <Copy>
              {holds
                ? `Tạm giữ ${amount} Credit của bạn cho toàn bộ việc học.`
                : `Bạn là người dạy và không cần tạm giữ Credit. Người học sẽ tạm giữ ${amount} Credit.`}
            </Copy>
            <Copy>
              {a.exchangeType === "TWO_WAY"
                ? "Khi tất cả buổi học hoàn tất hợp lệ, bạn nhận lại 96% khoản của chính mình; phí nền tảng 4%."
                : "Khi tất cả buổi học hoàn tất hợp lệ, người dạy nhận 96% giá học; phí nền tảng 4%."}
            </Copy>
            <Copy muted>
              Khoản Credit được giữ đến khi đủ điều kiện quyết toán cuối lộ
              trình. Chốt lịch sẽ tạo buổi học và khóa lịch đã đồng ý.
            </Copy>
            {check.ready && (
              <>
                <ConnectionFeedback error={check.error} />
                {check.isFetching && (
                  <Copy>Đang kiểm tra lịch trùng và số dư…</Copy>
                )}
                {check.canFinalize && (
                  <FormNotice tone="success">
                    Đủ điều kiện chốt. Hệ thống sẽ kiểm tra lại khi bạn xác
                    nhận.
                  </FormNotice>
                )}
                {!!check.error && (
                  <Button
                    variant="paper"
                    disabled={
                      blocked ||
                      check.isFetching ||
                      finalize.pending ||
                      finalize.uncertain
                    }
                    onPress={() => {
                      void check.refetch();
                    }}
                  >
                    Thử kiểm tra lại điều kiện
                  </Button>
                )}
              </>
            )}
            <Button
              disabled={
                !check.canFinalize || finalize.pending || finalize.uncertain
              }
              onPress={() => {
                if (
                  !check.canFinalize ||
                  finalize.pending ||
                  finalize.uncertain
                )
                  return;
                void finalize
                  .run(
                    `finalize:${path.id}:${path.currentVersion}`,
                    (identity) =>
                      api.finalize(path.id, path.currentVersion, identity),
                  )
                  .then((result) => {
                    if (result) refresh();
                  });
              }}
            >
              {finalizeLabel}
            </Button>
            <ConnectionFeedback error={finalize.error} />
          </Panel>
        </>
      )}
      <RouteButton secondary href={`/paths/${path.id}`}>
        Về tổng quan việc học
      </RouteButton>
    </>
  );
}
function ReviewPlan({
  plan,
  userId,
}: Readonly<{
  plan: ApiLearningPlan;
  userId?: string;
}>) {
  const skill = useCatalogName(plan.skillId);
  return (
    <>
      <Copy>
        {plan.teacherId === userId ? "Bạn dạy" : "Bạn học"}:{" "}
        {skill.data ?? "Kỹ năng"} · {plan.totalSessions} buổi
      </Copy>
      <Copy muted>{plan.learningGoal}</Copy>
      {plan.schedule?.items.map((item) => (
        <Copy key={item.sessionNo}>
          Buổi {item.sessionNo}:{" "}
          {new Date(item.startAt).toLocaleString("vi-VN")} –{" "}
          {new Date(item.endAt).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Copy>
      ))}
    </>
  );
}
