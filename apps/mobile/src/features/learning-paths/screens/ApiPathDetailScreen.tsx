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
  useParticipantName,
} from "@/features/connections";
import {
  useLearningPath,
  useLearningPathsApi,
} from "../hooks/use-learning-paths-api";
import { editablePath, ownConfirmation, pathStatusLabel } from "../policy-api";
import type { ApiLearningPath } from "../api/learning-paths-contract";
import { PathReadFeedback } from "../components/PathReadFeedback";
import { ApiPlanPanel } from "../components/ApiPlanPanel";
import {
  JourneyProgress,
  JourneyNextStep,
} from "../components/LearningJourney";
import { learningJourney } from "../journey";

export function ApiPathDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useLearningPath(id);
  return (
    <FeaturePage
      title="Việc học của hai bạn"
      demo={false}
      back="/my-learning?tab=paths"
    >
      {query.data && (
        <PathContent
          path={query.data}
          blocked={!!query.error || query.isFetching}
        />
      )}
      <PathReadFeedback query={query} />
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
  const agreement = path.agreement;
  const confirmed = !!ownConfirmation(path, agreement, runtime.userId);
  const otherConfirmed =
    path.participantAId === runtime.userId
      ? agreement.participantBConfirmedAt
      : agreement.participantAConfirmedAt;
  const journey = learningJourney(path, runtime.userId);
  return (
    <>
      <JourneyProgress step={journey.step} done={path.lockedVersion !== null} />
      <Panel title={`Học cùng ${name.data ?? "người trao đổi"}`}>
        <Copy>{pathStatusLabel[path.status]}</Copy>
        <Copy>
          {agreement.exchangeType === "TWO_WAY"
            ? "Hai bạn học kỹ năng của nhau"
            : "Một người dạy, một người học"}
        </Copy>
      </Panel>
      <JourneyNextStep journey={journey} blocked={blocked} />
      {path.plans.map((plan) => (
        <ApiPlanPanel
          key={plan.id}
          path={path}
          plan={plan}
          blocked={blocked}
          compact
        />
      ))}
      <Panel title="Hình thức và Credit">
        <Copy>
          {agreement.exchangeType === "TWO_WAY"
            ? `Mỗi người cam kết ${agreement.totalCreditPerUser} Credit cho toàn bộ việc học.`
            : `Tổng giá học: ${agreement.negotiatedCredit} Credit. Chỉ người học tạm giữ khoản này khi chốt lịch.`}
        </Copy>
        <Copy muted>
          {agreement.exchangeType === "TWO_WAY"
            ? "Khi hoàn tất hợp lệ, mỗi người nhận lại 96% khoản của chính mình; phí nền tảng 4%."
            : "Khi hoàn tất hợp lệ, người dạy nhận 96%; phí nền tảng 4%."}
        </Copy>
        <Copy>
          Bạn: {confirmed ? "đã đồng ý" : "chưa đồng ý"} · Người trao đổi:{" "}
          {otherConfirmed ? "đã đồng ý" : "chưa đồng ý"}
        </Copy>
        {editablePath(path) && (
          <>
            <Copy muted>
              Đồng ý phần này chưa giữ Credit. Bạn vẫn xác nhận riêng nội dung
              học và lịch.
            </Copy>
            {!confirmed && (
              <Button
                disabled={blocked || command.pending || command.uncertain}
                onPress={() => {
                  if (!blocked && !command.pending && !command.uncertain)
                    void command.run(
                      `agreement:${path.id}:${path.currentVersion}`,
                      () => api.confirm(path.id, path.currentVersion),
                    );
                }}
              >
                Tôi đồng ý hình thức và Credit
              </Button>
            )}
            {!blocked && (
              <RouteButton secondary href={`/paths/${path.id}/terms`}>
                Thay đổi hình thức hoặc Credit
              </RouteButton>
            )}
          </>
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
      </Panel>
      {path.status === "CONFIRMED" && journey.step < 4 && (
        <RouteButton secondary href={`/paths/${path.id}/schedules`}>
          Xem tất cả lịch học
        </RouteButton>
      )}
      <RouteButton secondary href={`/chat/${path.conversationId}`}>
        Nhắn tin với người trao đổi
      </RouteButton>
    </>
  );
}
