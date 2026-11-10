import { PathReadFeedback } from "../components/PathReadFeedback";
import { useRef } from "react";
import {
  ScheduleListOverview,
  ScheduleReadCard,
  ScheduleExchangeContext,
  ScheduleMissingPlanCard,
  ScheduleTimezoneNotice,
} from "../components/schedule-read-card";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ApiFinalizePanel } from "./ApiHoldScreen";

import { RouteButton } from "@/components/feature-page";
import { FlowPage as FeaturePage } from "@/components/learning-flow";
import { Button } from "@/components/Button";

import { EmptyState } from "@/components/EmptyState";
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
import {
  canSchedule,
  canEditSchedule,
  canConfirmSchedule,
  canValidateForFinalize,
} from "../utils/policy-api";
import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";
import { ScheduleForm } from "../components/schedule-editor-form";
import {
  ConfirmedFormFeedback,
  useConfirmedFormShare,
} from "@/features/messages/state";
import { FormNotice } from "@/components/FormNotice";
import { scheduleDirections } from "../utils/schedule-directions";
import { usePullRefresh } from "../hooks/use-pull-refresh";
import { confirmAndShare } from "../api/confirm-and-share";
import { scheduleConfirmationMessage } from "../utils/schedule-confirmation-message";

export function ApiSchedulesScreen() {
  const { id, formPlanId, formScheduleId, formVersion } = useLocalSearchParams<{
    id: string;
    formPlanId?: string;
    formScheduleId?: string;
    formVersion?: string;
  }>();
  const query = useLearningPath(id),
    path = query.data;
  const runtime = useConnections();
  const pullRefresh = usePullRefresh(query.refetch);
  const blocked = !!query.error || query.isFetching;
  return (
    <FeaturePage
      title="Lịch học"
      demo={false}
      backBehavior="history"
      back={`/paths/${id}`}
      refreshing={pullRefresh.refreshing}
      onRefresh={pullRefresh.onRefresh}
    >
      <PathReadFeedback query={query} />
      {path && (
        <>
          {formVersion &&
            (() => {
              const current = path.plans.find(
                (plan) => plan.id === formPlanId,
              )?.schedule;
              return !current ||
                current.id !== formScheduleId ||
                String(current.version) !== formVersion ? (
                <FormNotice tone="info" compact>
                  Lịch đã thay đổi sau khi gửi form này. Hãy xem lịch hiện tại
                  trước khi xác nhận.
                </FormNotice>
              ) : null;
            })()}
          <ConfirmedFormFeedback conversationId={path.conversationId} />
          <ScheduleListOverview
            path={path}
            blocked={blocked}
            userId={runtime.userId}
          />
          <ScheduleExchangeContext path={path} />
          {scheduleDirections(path, runtime.userId).map(
            ({ key, plan, mine }) =>
              plan ? (
                <SchedulePanel
                  key={key}
                  path={path}
                  plan={plan}
                  blocked={blocked}
                />
              ) : (
                <ScheduleMissingPlanCard
                  key={key}
                  path={path}
                  mine={mine}
                  blocked={blocked}
                />
              ),
          )}
          <ScheduleTimezoneNotice />
          {(canValidateForFinalize(path) || path.lockedVersion !== null) && (
            <ApiFinalizePanel
              path={path}
              blocked={blocked}
              refresh={query.refetch}
            />
          )}
        </>
      )}
    </FeaturePage>
  );
}
function SchedulePanel({
  path,
  plan,
  blocked,
}: Readonly<{
  path: ApiLearningPath;
  plan: ApiLearningPlan;
  blocked: boolean;
}>) {
  const api = useLearningPathsApi(),
    command = useConnectionCommand([
      ["learning-paths", path.id],
      ["learning-paths", "mine"],
    ]),
    runtime = useConnections();
  const skill = useCatalogName(plan.skillId),
    schedule = plan.schedule;
  const router = useRouter();
  const share = useConfirmedFormShare();
  return (
    <ScheduleReadCard
      path={path}
      plan={plan}
      skill={skill.data ?? "Lộ trình học"}
      userId={runtime.userId}
      blocked={blocked}
    >
      {schedule && (
        <>
          {canConfirmSchedule(path, plan, runtime.userId) && (
            <Button
              disabled={blocked || command.pending}
              onPress={() => {
                if (
                  blocked ||
                  command.pending ||
                  !runtime.isCurrent() ||
                  !canConfirmSchedule(path, plan, runtime.userId)
                )
                  return;
                void command.run(
                  `schedule:${schedule.id}:${schedule.version}`,
                  confirmAndShare(
                    () => api.confirmSchedule(schedule.id, schedule.version),
                    (result, identity) => {
                      // A stale screen may receive an already-locked replay.
                      // It is not a new confirmation awaiting finalization.
                      if (result.status === "LOCKED") return;
                      void share.publish(
                        path.conversationId,
                        scheduleConfirmationMessage({
                          pathId: path.id,
                          planId: plan.id,
                          scheduleId: schedule.id,
                          version: result.version,
                          confirmedBy: runtime.userId!,
                          teacherId: plan.teacherId,
                          learnerId: plan.learnerId,
                          bothConfirmed: result.bothConfirmed,
                          title: plan.learningGoal,
                        }),
                        identity,
                      );
                    },
                    runtime.isCurrent,
                  ),
                );
              }}
            >
              Đồng ý lịch học
            </Button>
          )}
          <ConnectionFeedback error={command.error} />
        </>
      )}
      {canSchedule(path, plan, runtime.userId) && !blocked && (
        <RouteButton href={`/paths/${path.id}/schedules/${plan.id}`}>
          Đề xuất lịch tôi dạy
        </RouteButton>
      )}
      {canEditSchedule(path, plan, runtime.userId) && (
        <Button
          variant="secondary"
          leadingIcon="edit"
          disabled={blocked || command.pending || command.uncertain}
          onPress={() => router.push(`/paths/${path.id}/schedules/${plan.id}`)}
        >
          Chỉnh sửa lịch tôi dạy
        </Button>
      )}
    </ScheduleReadCard>
  );
}
export function ApiScheduleEditorScreen() {
  const { id, planId } = useLocalSearchParams<{ id: string; planId: string }>();
  const query = useLearningPath(id),
    runtime = useConnections(),
    path = query.data;
  const plan = path?.plans.find((p) => p.id === planId);
  const allowed =
    !!path &&
    !!plan &&
    (canSchedule(path, plan, runtime.userId) ||
      canEditSchedule(path, plan, runtime.userId));
  const resource = `${id}:${planId}`;
  const opened = useRef<string | undefined>(undefined);
  if (allowed) opened.current = resource;
  const showEditor = allowed || opened.current === resource;
  return (
    <FeaturePage
      title={plan?.schedule ? "Chỉnh sửa lịch tôi dạy" : "Đề xuất lịch tôi dạy"}
      scrollable={false}
      demo={false}
      backBehavior="history"
      back={`/paths/${id}/schedules`}
    >
      <PathReadFeedback query={query} />
      {path && plan && showEditor && !allowed && (
        <FormNotice tone="info" compact>
          Thỏa thuận hiện chưa cho phép chỉnh sửa lịch. Bản đang nhập được giữ
          lại.
        </FormNotice>
      )}
      {path && plan && showEditor ? (
        <ScheduleForm
          key={`${path.id}:${plan.id}`}
          path={path}
          plan={plan}
          blocked={!!query.error || !allowed}
        />
      ) : (
        path && (
          <EmptyState
            title="Chưa thể chỉnh sửa lịch"
            description="Chỉ người dạy tạo hoặc sửa lịch trước khi chốt, sau khi thỏa thuận và các lộ trình đủ xác nhận."
          />
        )
      )}
    </FeaturePage>
  );
}
