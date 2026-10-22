import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { uuid } from "@/lib/http/contracts";
import { EmptyState } from "@/components/EmptyState";
import { FlowPage as FeaturePage } from "@/components/learning-flow";
import { Copy } from "@/components/feature-page";
import { Button } from "@/components/Button";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionCommand,
  useCatalogName,
  useParticipantName,
} from "@/features/connections";
import { PathReadFeedback } from "../components/PathReadFeedback";
import { AgreementScheduleStep } from "../components/agreement-schedule-step";
import { AgreementMethodStep } from "../components/agreement-method-step";
import {
  AgreementSteps,
  type AgreementStep,
} from "../components/agreement-steps";
import {
  useLearningPath,
  useLearningPathsApi,
} from "../hooks/use-learning-paths-api";
import {
  canConfirmPlan,
  agreementConfirmed,
  editablePath,
  canEditPlan,
} from "../utils/policy-api";
import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";
import { agreementProgress } from "../utils/progression";
import {
  useConfirmedFormShare,
  ConfirmedFormFeedback,
} from "@/features/messages/state";
import { confirmedFormMessage } from "../utils/confirmed-form";
import { confirmAndShare } from "../api/confirm-and-share";
import { FormNotice } from "@/components/FormNotice";
import { AgreementContext } from "../components/agreement-context";
import { AgreementPlansStep } from "../components/agreement-plans-step";
import { PlanDetailContent } from "../components/plan-detail-content";
import { usePullRefresh } from "../hooks/use-pull-refresh";

function agreementBackTarget(
  source: ReturnType<typeof uuid.safeParse>,
  conversationId?: string,
) {
  const id = source.success ? source.data : conversationId;
  if (id)
    return {
      pathname: "/chat/[proposalId]" as const,
      params: { proposalId: id, mode: "api" as const },
    };
  return "/my-learning?tab=paths" as const;
}

function agreementStepFor(
  stage: ReturnType<typeof agreementProgress>["stage"],
): AgreementStep {
  if (stage === "terms") return "method";
  if (stage === "plans") return "plans";
  return "schedules";
}

export function ApiPathDetailScreen() {
  const { id, fromConversation, formVersion } = useLocalSearchParams<{
    id: string;
    fromConversation?: string;
    formVersion?: string;
  }>();
  const source = uuid.safeParse(fromConversation);
  const query = useLearningPath(id);
  const pullRefresh = usePullRefresh(query.refetch);
  return (
    <FeaturePage
      title="Thỏa thuận học"
      backBehavior="history"
      back={agreementBackTarget(source, query.data?.conversationId)}
      refreshing={pullRefresh.refreshing}
      onRefresh={pullRefresh.onRefresh}
    >
      <PathReadFeedback query={query} />
      {query.data &&
        (!source.success || query.data.conversationId === source.data) && (
          <>
            <ConfirmedFormFeedback conversationId={query.data.conversationId} />
            {formVersion &&
              formVersion !== String(query.data.currentVersion) && (
                <FormNotice tone="info">
                  Thỏa thuận đã đổi phiên bản sau khi gửi form này. Bạn đang xem
                  bản hiện tại.
                </FormNotice>
              )}
          </>
        )}
      {query.data &&
        (!source.success || query.data.conversationId === source.data) && (
          <PathContent
            key={query.data.id}
            path={query.data}
            blocked={!!query.error}
            onRefresh={query.refetch}
          />
        )}
      {query.data &&
        source.success &&
        query.data.conversationId !== source.data && (
          <EmptyState
            title="Thỏa thuận không thuộc cuộc trò chuyện này"
            description="Quay lại Chat và mở thỏa thuận của hai bạn."
          />
        )}
    </FeaturePage>
  );
}
function PathContent({
  path,
  blocked,
  onRefresh,
}: Readonly<{
  path: ApiLearningPath;
  blocked: boolean;
  onRefresh: () => unknown;
}>) {
  const router = useRouter();
  const runtime = useConnections();
  const { editTerms } = useLocalSearchParams<{ editTerms?: string }>();
  const progress = agreementProgress(path, runtime.userId);
  const current = agreementStepFor(progress.stage);
  const [reviewing, setReviewing] = useState<AgreementStep | undefined>(
    editTerms === "1" ? "method" : undefined,
  );
  const order: AgreementStep[] = ["method", "plans", "schedules"];
  const selected =
    reviewing && order.indexOf(reviewing) <= order.indexOf(current)
      ? reviewing
      : current;
  const otherId =
    path.participantAId === runtime.userId
      ? path.participantBId
      : path.participantAId;
  const name = useParticipantName(otherId);
  return (
    <>
      <AgreementContext
        name={name.data ?? "đối tác"}
        pathId={path.id}
        partnerId={otherId}
      />
      {path.status === "COMPLETED" && path.settledAt !== null && (
        <Button onPress={() => router.push(`/paths/${path.id}/review`)}>
          Xem / viết đánh giá
        </Button>
      )}
      <AgreementSteps
        value={selected}
        current={current}
        onSelect={setReviewing}
      />
      {selected === "method" && (
        <AgreementMethodStep
          path={path}
          blocked={blocked}
          initiallyEditing={editTerms === "1"}
          onContinue={() => setReviewing("plans")}
          onRefresh={onRefresh}
        />
      )}
      {selected === "plans" && (
        <AgreementPlansStep
          path={path}
          userId={runtime.userId}
          partnerName={name.data ?? "Đối tác"}
          blocked={blocked}
          canContinue={current === "schedules"}
          onReviewMethod={() => setReviewing("method")}
          onContinue={() => setReviewing("schedules")}
        />
      )}
      {selected === "schedules" && (
        <AgreementScheduleStep
          path={path}
          userId={runtime.userId}
          blocked={blocked}
          onReviewPlans={() => setReviewing("plans")}
        />
      )}
    </>
  );
}
export function ApiPlanPanel({
  plan,
}: Readonly<{
  plan: ApiLearningPlan;
}>) {
  const runtime = useConnections();
  const skill = useCatalogName(plan.skillId);
  return (
    <PlanDetailContent
      plan={plan}
      skill={skill.data ?? "Lộ trình học"}
      mine={plan.teacherId === runtime.userId}
    />
  );
}

export function ApiPlanActions({
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
  const router = useRouter();
  const share = useConfirmedFormShare();
  const canConfirm = canConfirmPlan(path, plan, runtime.userId);
  const canEdit = canEditPlan(path, plan, runtime.userId) && !blocked;
  const termsNeedConfirmation = editablePath(path) && !agreementConfirmed(path);
  const canContinue =
    plan.learnerConfirmedAt && plan.learnerId === runtime.userId;
  let footerAction: ReactNode = null;
  if (termsNeedConfirmation)
    footerAction = (
      <Button
        leadingIcon="arrow"
        style={actionStyles.primary}
        onPress={() => router.dismissTo(`/paths/${path.id}`)}
      >
        Xem cách học cần xác nhận
      </Button>
    );
  if (canEdit)
    footerAction = (
      <Button
        leadingIcon="edit"
        style={actionStyles.primary}
        onPress={() => router.push(`/paths/${path.id}/plans/${plan.id}/edit`)}
      >
        Chỉnh sửa lộ trình
      </Button>
    );
  if (canContinue)
    footerAction = (
      <Button
        leadingIcon="arrow"
        style={actionStyles.primary}
        onPress={() => router.dismissTo(`/paths/${path.id}`)}
      >
        Tiếp tục thỏa thuận lịch học
      </Button>
    );
  if (canConfirm)
    footerAction = (
      <Button
        disabled={blocked || command.pending || command.uncertain}
        leadingIcon="check-circle"
        style={actionStyles.primary}
        onPress={() => {
          void command.run(
            `plan:${plan.id}:${plan.version}`,
            confirmAndShare(
              () => api.confirmPlan(plan.id, plan.version),
              (result, identity) => {
                void share.publish(
                  path.conversationId,
                  confirmedFormMessage({
                    kind: "plan",
                    pathId: path.id,
                    planId: plan.id,
                    version: result.version,
                    title: plan.learningGoal,
                    summary: `${plan.totalSessions} buổi · Người học xác nhận lộ trình`,
                  }),
                  identity,
                );
              },
              runtime.isCurrent,
            ),
          );
        }}
      >
        Đồng ý lộ trình này
      </Button>
    );

  return (
    <View style={actionStyles.footer}>
      {(command.error || command.uncertain) && (
        <View style={actionStyles.feedback}>
          <ConnectionFeedback error={command.error} />
          {command.uncertain && (
            <Copy muted>
              Chưa rõ kết quả xác nhận. Tải lại trạng thái để kiểm tra.
            </Copy>
          )}
        </View>
      )}
      {footerAction}
      <Button
        variant="secondary"
        leadingIcon="message"
        style={actionStyles.secondary}
        onPress={() =>
          router.dismissTo({
            pathname: "/chat/[proposalId]",
            params: { proposalId: path.conversationId, mode: "api" },
          })
        }
      >
        Trao đổi qua Chat
      </Button>
    </View>
  );
}

const actionStyles = StyleSheet.create({
  footer: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8E6E2",
    backgroundColor: "#FFFEFC",
  },
  primary: { width: "100%", minHeight: 48, borderRadius: 12 },
  secondary: { width: "100%", minHeight: 44, borderRadius: 12 },
  feedback: { gap: 6 },
});
