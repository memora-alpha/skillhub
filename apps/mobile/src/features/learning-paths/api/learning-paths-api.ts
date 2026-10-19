import { z } from "zod";
import type { RequestOptions } from "@/lib/http/client";
import { AppError } from "@/lib/http/errors";
import {
  parse,
  resourcePath,
  uuid,
  version,
  timestamp,
} from "@/lib/http/contracts";
import {
  learningPathSchema,
  pathSummarySchema,
  pathStatus,
  scheduleItem,
  type CreateLearningPathInput,
  type CreateLearningPlanInput,
  type LearningAgreementInput,
} from "./learning-paths-contract";

const command = z.object({ id: uuid, version, status: z.string() });
export const validationSchema = z.object({
  pathId: uuid,
  version,
  exchangeType: z.enum(["ONE_WAY", "TWO_WAY"]),
  planCount: z.number().int(),
  scheduleCount: z.number().int(),
  ready: z.literal(true),
});
const finalized = z.object({
  pathId: uuid,
  version,
  status: pathStatus,
  sessions: z.array(
    z.object({
      id: uuid,
      planId: uuid,
      startAt: timestamp,
      endAt: timestamp,
      status: z.string().optional(),
    }),
  ),
});
export function createLearningPathsApi(
  call: (path: string, options?: RequestOptions) => Promise<unknown>,
  userId: string,
) {
  const pathUrl = (id: string) => resourcePath("learning-paths", id);
  const post = (url: string, body?: unknown, idempotencyKey?: string) =>
    call(url, {
      method: "POST",
      body,
      idempotencyKey,
      replayAfterRenewal: false,
    });
  return {
    async mine(signal?: AbortSignal) {
      const result = parse(
        z.array(pathSummarySchema).max(100),
        await call("/learning-paths/mine", { signal }),
      );
      if (
        new Set(result.map((p) => p.id)).size !== result.length ||
        result.some((p) => p.counterpartId === userId)
      )
        throw new AppError("protocol");
      return result;
    },
    async detail(id: string, signal?: AbortSignal) {
      const path = parse(
        learningPathSchema,
        await call(pathUrl(id), { signal }),
      );
      const participants = [path.participantAId, path.participantBId];
      if (
        path.id !== id ||
        !participants.includes(userId) ||
        participants[0] === participants[1] ||
        path.agreement.version !== path.currentVersion ||
        new Set(path.plans.map((p) => p.id)).size !== path.plans.length ||
        path.plans.some(
          (p) =>
            !participants.includes(p.teacherId) ||
            !participants.includes(p.learnerId) ||
            p.teacherId === p.learnerId ||
            p.sessionOutline.length !== p.totalSessions ||
            p.sessionOutline.some((s, i) => s.sessionNo !== i + 1) ||
            (p.schedule &&
              (p.schedule.items.length !== p.totalSessions ||
                p.schedule.items.some((s, i) => s.sessionNo !== i + 1))),
        )
      )
        throw new AppError("protocol");
      return path;
    },
    async create(input: CreateLearningPathInput) {
      return parse(command, await post("/learning-paths", input));
    },
    async revise(
      id: string,
      input: LearningAgreementInput,
      expectedVersion: number,
    ) {
      // The shared form also carries conversationId. PATCH only accepts agreement terms.
      const terms =
        input.exchangeType === "TWO_WAY"
          ? {
              exchangeType: input.exchangeType,
              totalCreditPerUser: input.totalCreditPerUser,
            }
          : {
              exchangeType: input.exchangeType,
              teacherId: input.teacherId,
              learnerId: input.learnerId,
              negotiatedCredit: input.negotiatedCredit,
            };
      const result = parse(
        command,
        await call(pathUrl(id), {
          method: "PATCH",
          body: { ...terms, expectedVersion },
          replayAfterRenewal: false,
        }),
      );
      if (result.id !== id || result.version !== expectedVersion + 1)
        throw new AppError("protocol");
      return result;
    },
    async addPlan(id: string, input: CreateLearningPlanInput) {
      return parse(command, await post(`${pathUrl(id)}/plans`, input));
    },
    async revisePlan(
      id: string,
      input: CreateLearningPlanInput,
      expectedVersion: number,
    ) {
      const result = parse(
        command,
        await call(resourcePath("learning-paths/plans", id), {
          method: "PATCH",
          body: { ...input, expectedVersion },
          replayAfterRenewal: false,
        }),
      );
      if (result.id !== id || result.version !== expectedVersion + 1)
        throw new AppError("protocol");
      return result;
    },
    async confirm(id: string, expectedVersion: number) {
      const result = parse(
        z.object({ id: uuid, currentVersion: version, status: pathStatus }),
        await post(`${pathUrl(id)}/confirm`, { expectedVersion }),
      );
      if (result.id !== id || result.currentVersion !== expectedVersion)
        throw new AppError("protocol");
      return result;
    },
    async confirmPlan(id: string, expectedVersion: number) {
      const result = parse(
        command,
        await post(`${resourcePath("learning-paths/plans", id)}/confirm`, {
          expectedVersion,
        }),
      );
      if (result.id !== id || result.version !== expectedVersion)
        throw new AppError("protocol");
      return result;
    },
    async schedule(
      id: string,
      expectedPlanVersion: number,
      items: z.infer<typeof scheduleItem>[],
    ) {
      return parse(
        command,
        await post(`${resourcePath("learning-plans", id)}/schedule-proposals`, {
          expectedPlanVersion,
          items,
        }),
      );
    },
    async confirmSchedule(id: string, expectedVersion: number) {
      const result = parse(
        command.extend({ bothConfirmed: z.boolean() }),
        await post(`${resourcePath("schedule-proposals", id)}/confirm`, {
          expectedVersion,
        }),
      );
      if (result.id !== id || result.version !== expectedVersion)
        throw new AppError("protocol");
      return result;
    },
    async validate(id: string) {
      const result = parse(
        validationSchema,
        await post(`${pathUrl(id)}/final-validation`),
      );
      if (result.pathId !== id) throw new AppError("protocol");
      return result;
    },
    async finalize(id: string, expectedVersion: number, identity: string) {
      const result = parse(
        finalized,
        await post(`${pathUrl(id)}/finalize`, { expectedVersion }, identity),
      );
      if (result.pathId !== id || result.version !== expectedVersion)
        throw new AppError("protocol");
      return result;
    },
  };
}
