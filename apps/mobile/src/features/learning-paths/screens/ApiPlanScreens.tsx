import { PathReadFeedback } from "../components/PathReadFeedback";
import { useCallback, useRef, useState } from "react";
import {
  useLocalSearchParams,
  useRouter,
  useFocusEffect,
  type Href,
} from "expo-router";

import { Copy } from "@/components/feature-page";
import { FlowPage as FeaturePage } from "@/components/learning-flow";
import { Button } from "@/components/Button";

import { EmptyState } from "@/components/EmptyState";

import { ConnectionFeedback, useConnections } from "@/features/connections";

import { useLearningPath } from "../hooks/use-learning-paths-api";
import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";
import {
  agreementConfirmed,
  canCreatePlan,
  canEditPlan,
} from "../utils/policy-api";
import { ApiPlanActions, ApiPlanPanel } from "./ApiPathDetailScreen";
import { FormNotice } from "@/components/FormNotice";
import { useMessageSend } from "@/features/messages";
import { planShareMessage } from "../utils/plan-share";
import { uuid } from "@/lib/http/contracts";
import { ConfirmedFormFeedback } from "@/features/messages/state";

import { PlanForm } from "../components/plan-editor-form";
import { PlanShareCard } from "../components/plan-detail-content";
import { usePullRefresh } from "../hooks/use-pull-refresh";

function conversationForPlan(
  source: ReturnType<typeof uuid.safeParse>,
  sharedVersion: string | undefined,
  conversationId: string | undefined,
) {
  if (source.success) return source.data;
  if (sharedVersion) return conversationId;
  return undefined;
}

function planBackTarget(
  conversationId: string | undefined,
  sharedVersion: string | undefined,
  pathId: string,
): Href {
  if (conversationId)
    return {
      pathname: "/chat/[proposalId]",
      params: { proposalId: conversationId, mode: "api" },
    };
  if (sharedVersion) return "/messages";
  return `/paths/${pathId}`;
}
export function ApiPlanDetailScreen() {
  const {
    id,
    planId,
    sharedVersion: sharedHint,
    version: versionHint,
    fromConversation,
  } = useLocalSearchParams<{
    id: string;
    planId: string;
    sharedVersion?: string;
    version?: string;
    fromConversation?: string;
  }>();
  const sharedVersion = sharedHint ?? versionHint;
  const query = useLearningPath(id),
    plan = query.data?.plans.find((p) => p.id === planId);
  const source = uuid.safeParse(fromConversation);
  const conversationId = conversationForPlan(
    source,
    sharedVersion,
    query.data?.conversationId,
  );
  const matchesSource =
    !source.success || query.data?.conversationId === source.data;
  const pullRefresh = usePullRefresh(query.refetch);
  return (
    <FeaturePage
      title="Chi tiết lộ trình"
      demo={false}
      stickyFooter={
        query.data && plan && matchesSource ? (
          <ApiPlanActions
            path={query.data}
            plan={plan}
            blocked={!!query.error}
          />
        ) : undefined
      }
      backBehavior="history"
      back={planBackTarget(conversationId, sharedVersion, id)}
      refreshing={pullRefresh.refreshing}
      onRefresh={pullRefresh.onRefresh}
    >
      <PathReadFeedback query={query} />
      {query.data && plan && matchesSource && (
        <>
          {sharedVersion && sharedVersion !== String(plan.version) && (
            <FormNotice tone="info" compact>
              Lộ trình đã được cập nhật. Bạn đang đọc bản mới nhất (
              {plan.version}); hãy xem lại nội dung trước khi xác nhận.
            </FormNotice>
          )}
          <ApiPlanPanel plan={plan} />
          <ConfirmedFormFeedback conversationId={query.data.conversationId} />
          {!conversationId && (
            <SharePlan path={query.data} plan={plan} blocked={!!query.error} />
          )}
        </>
      )}
      {query.data && (!plan || !matchesSource) && (
        <EmptyState
          title="Không tìm thấy lộ trình trong cuộc trò chuyện này"
          description="Quay lại và nhờ người dạy gửi lại lộ trình đang áp dụng."
        />
      )}
    </FeaturePage>
  );
}
export function ApiPlanEditorScreen() {
  const router = useRouter();
  const { id, planId } = useLocalSearchParams<{
    id: string;
    planId?: string;
  }>();
  const query = useLearningPath(id),
    runtime = useConnections();
  const path = query.data,
    plan = path?.plans.find((p) => p.id === planId);
  const allowed =
    path &&
    (planId
      ? plan && canEditPlan(path, plan, runtime.userId)
      : canCreatePlan(path, runtime.userId));
  const resource = `${id}:${planId ?? "new"}`;
  const opened = useRef<string | undefined>(undefined);
  if (allowed) opened.current = resource;
  const showEditor =
    allowed || (opened.current === resource && (!planId || !!plan));
  return (
    <FeaturePage
      title={planId ? "Chỉnh sửa lộ trình" : "Tạo lộ trình"}
      scrollable={false}
      demo={false}
      backBehavior="history"
      back={planId ? `/paths/${id}/plans/${planId}` : `/paths/${id}`}
    >
      <PathReadFeedback query={query} />
      {showEditor && path && (
        <PlanForm
          key={`${path.id}:${plan?.id ?? "new"}`}
          path={path}
          plan={plan}
          blocked={!!query.error || !allowed}
        />
      )}
      {path && !allowed && (
        <EmptyState
          title={
            agreementConfirmed(path)
              ? "Không thể sửa lộ trình này"
              : "Cần thống nhất cách học trước"
          }
          description={
            agreementConfirmed(path)
              ? "Bạn chỉ tạo hoặc sửa lộ trình mình dạy khi thỏa thuận chưa khóa."
              : "Mở Thỏa thuận để cả hai xác nhận hình thức, vai trò và Credit của phiên bản hiện tại."
          }
        />
      )}
      {path && !agreementConfirmed(path) && (
        <Button
          variant="secondary"
          onPress={() => router.dismissTo(`/paths/${path.id}`)}
        >
          Xem cách học cần xác nhận
        </Button>
      )}
    </FeaturePage>
  );
}
function SharePlan({
  path,
  plan,
  blocked,
}: Readonly<{
  path: ApiLearningPath;
  plan: ApiLearningPlan;
  blocked: boolean;
}>) {
  const sender = useMessageSend(path.conversationId),
    runtime = useConnections(),
    router = useRouter();
  const [shared, setShared] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (
        shared &&
        !sender.pending &&
        !sender.processing &&
        runtime.isCurrent()
      )
        router.dismissTo({
          pathname: "/chat/[proposalId]",
          params: { proposalId: path.conversationId, mode: "api" },
        });
    }, [
      shared,
      sender.pending,
      sender.processing,
      runtime,
      router,
      path.conversationId,
    ]),
  );
  if (plan.teacherId !== runtime.userId) return null;
  return (
    <PlanShareCard>
      <ConnectionFeedback error={sender.error ?? sender.delivery.error} />
      <Button
        disabled={
          blocked || sender.pending || sender.processing || sender.uncertain
        }
        onPress={() => {
          const text = planShareMessage(
            path.id,
            plan.id,
            plan.version,
            plan.learningGoal,
            plan.totalSessions,
          );
          void sender.send(text).then((sent) => {
            if (sent && runtime.isCurrent()) setShared(true);
          });
        }}
      >
        {sender.pending ? "Đang gửi…" : "Gửi lộ trình qua Chat"}
      </Button>
      {sender.uncertain && (
        <Button
          variant="secondary"
          disabled={blocked || sender.pending}
          onPress={() => {
            void sender.retryPrevious().then((sent) => {
              if (sent && runtime.isCurrent()) setShared(true);
            });
          }}
        >
          Kiểm tra lại lần chia sẻ trước
        </Button>
      )}
      {sender.processing && (
        <>
          <Copy muted size="hint">
            Lộ trình đang được gửi. Kiểm tra trước khi rời màn hình.
          </Copy>
          <Button
            variant="secondary"
            disabled={sender.delivery.isFetching}
            onPress={() => {
              void sender.delivery.refetch();
            }}
          >
            Kiểm tra lần gửi
          </Button>
        </>
      )}
    </PlanShareCard>
  );
}
