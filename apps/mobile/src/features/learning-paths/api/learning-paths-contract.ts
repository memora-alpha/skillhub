import { z } from "zod";
import { timestamp, uuid, version } from "@/lib/http/contracts";

export const pathStatus = z.enum([
  "DRAFT",
  "PROPOSED",
  "PARTIALLY_CONFIRMED",
  "CONFIRMED",
  "SCHEDULED",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
]);
const exchange = z.enum(["ONE_WAY", "TWO_WAY"]);
const confirmedAt = timestamp.nullable();
const confirmations = {
  participantAConfirmedAt: confirmedAt,
  participantBConfirmedAt: confirmedAt,
};
const credit = z.string().regex(/^\d+(\.\d{1,2})?$/);
export const scheduleItem = z.object({
  sessionNo: version,
  startAt: timestamp,
  endAt: timestamp,
});
export const planSchema = z.object({
  id: uuid,
  version,
  status: z.enum(["DRAFT", "PROPOSED", "CONFIRMED", "NEEDS_REVISION"]),
  teacherId: uuid,
  learnerId: uuid,
  skillId: uuid,
  learningGoal: z.string(),
  totalSessions: version.max(100),
  learnerConfirmedAt: confirmedAt,
  sessionOutline: z.array(
    z.object({ sessionNo: version, content: z.string() }),
  ),
  schedule: z
    .object({
      id: uuid,
      version,
      appliedVersion: version.nullable(),
      status: z.enum([
        "DRAFT",
        "PROPOSED",
        "PARTIALLY_CONFIRMED",
        "LOCKED",
        "NEEDS_REVISION",
        "CANCELLED",
        "EXPIRED",
      ]),
      ...confirmations,
      items: z.array(scheduleItem),
    })
    .nullable(),
  sessions: z.array(
    scheduleItem.extend({
      id: uuid,
      status: z.enum([
        "CONFIRMED",
        "READY",
        "ONGOING",
        "AWAITING_CONFIRMATION",
        "COMPLETED",
        "CANCELLED",
        "DISPUTED",
      ]),
    }),
  ),
});
export const learningPathSchema = z.object({
  id: uuid,
  conversationId: uuid,
  status: pathStatus,
  participantAId: uuid,
  participantBId: uuid,
  currentVersion: version,
  lockedVersion: version.nullable(),
  completedAt: confirmedAt,
  settledAt: confirmedAt,
  agreement: z.object({
    version,
    exchangeType: exchange,
    totalCreditPerUser: credit.nullable(),
    negotiatedCredit: credit.nullable(),
    teacherId: uuid.nullable(),
    learnerId: uuid.nullable(),
    ...confirmations,
  }),
  plans: z.array(planSchema).max(2),
});
export const pathSummarySchema = z.object({
  id: uuid,
  conversationId: uuid,
  status: pathStatus,
  exchangeType: exchange.nullable(),
  counterpartId: uuid,
  currentVersion: version,
  lockedVersion: version.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ApiLearningPath = z.infer<typeof learningPathSchema>;
export type ApiLearningPlan = z.infer<typeof planSchema>;
export type PathSummary = z.infer<typeof pathSummarySchema>;
export type LearningAgreementInput =
  | { exchangeType: "TWO_WAY"; totalCreditPerUser: string }
  | {
      exchangeType: "ONE_WAY";
      teacherId: string;
      learnerId: string;
      negotiatedCredit: string;
    };
export type CreateLearningPathInput = LearningAgreementInput & {
  conversationId: string;
};
export type CreateLearningPlanInput = {
  skillId: string;
  learningGoal: string;
  totalSessions: number;
  sessionOutline: { content: string }[];
};
export type ConfirmLearningVersionInput = { expectedVersion: number };
