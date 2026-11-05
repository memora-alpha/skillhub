import { Copy } from "@/components/feature-page";
import { FlowSection } from "@/components/learning-flow";
import { useCatalogName } from "@/features/connections";
import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";
import type { AgreementStep } from "./agreement-steps";
import { AgreementMethodSummary } from "./agreement-method-summary";
import { PlanDetailContent } from "./plan-detail-content";
import { ScheduleReadCard } from "./schedule-read-card";
import { ownConfirmation } from "../utils/policy-api";

export function CompletedAgreementReview({
  path,
  userId,
  partnerName,
  step,
}: Readonly<{
  path: ApiLearningPath;
  userId?: string;
  partnerName: string;
  step: Exclude<AgreementStep, "completion">;
}>) {
  const otherId =
    path.participantAId === userId ? path.participantBId : path.participantAId;
  return (
    <>
      <Copy muted size="hint">
        Thông tin đã thống nhất · Chỉ xem lại.
      </Copy>
      {step === "method" ? (
        <FlowSection>
          <AgreementMethodSummary
            path={path}
            userId={userId}
            otherId={otherId}
            otherName={partnerName}
            mine={!!ownConfirmation(path, path.agreement, userId)}
            other={!!ownConfirmation(path, path.agreement, otherId)}
          >
            {null}
          </AgreementMethodSummary>
        </FlowSection>
      ) : (
        path.plans.map((plan) => (
          <CompletedPlanReview
            key={plan.id}
            path={path}
            plan={plan}
            userId={userId}
            step={step}
          />
        ))
      )}
    </>
  );
}

function CompletedPlanReview({
  path,
  plan,
  userId,
  step,
}: Readonly<{
  path: ApiLearningPath;
  plan: ApiLearningPlan;
  userId?: string;
  step: "plans" | "schedules";
}>) {
  const skill = useCatalogName(plan.skillId);
  if (step === "plans")
    return (
      <PlanDetailContent
        plan={plan}
        skill={skill.data ?? "Lộ trình học"}
        mine={plan.teacherId === userId}
      />
    );
  return (
    <ScheduleReadCard
      path={path}
      plan={plan}
      skill={skill.data ?? "Lộ trình học"}
      userId={userId}
    >
      {null}
    </ScheduleReadCard>
  );
}
