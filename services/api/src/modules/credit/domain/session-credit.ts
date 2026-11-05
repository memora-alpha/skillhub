import { ConflictException } from "@nestjs/common";
import { z } from "zod";
import { MAX_CREDIT_UNITS } from "./money";

export const TWO_WAY_SESSION_POLICY = "TWO_WAY_PLAN_V2";
export const ONE_WAY_SESSION_POLICY = "ONE_WAY_SESSION_V1";
export type SessionCreditAgreement = {
  exchangeType: "ONE_WAY" | "TWO_WAY";
  participantAId: string;
  participantBId: string;
  teacherId: string | null;
  learnerId: string | null;
};
export type SessionCreditIdentity = {
  id: string;
  planId: string;
  planVersion: number;
  outlineSessionNo: number;
  teacherId: string;
  learnerId: string;
};
const units = z.string().regex(/^(?:0|[1-9]\d{0,11})$/);
const identity = z
  .object({
    id: z.string().min(1),
    planId: z.string().min(1),
    planVersion: z.number().int().positive(),
    outlineSessionNo: z.number().int().positive(),
    teacherId: z.string().min(1),
    learnerId: z.string().min(1),
  })
  .strict();
const snapshotSchema = z
  .object({
    policy: z.enum([
      TWO_WAY_SESSION_POLICY,
      ONE_WAY_SESSION_POLICY,
      "TWO_WAY_SESSION_V1",
    ]),
    ownerId: z.string().min(1).optional(),
    feeBps: z.literal(400),
    totalUnits: units,
    participantAId: z.string().min(1),
    participantBId: z.string().min(1),
    sessions: z.array(identity.extend({ creditUnits: units }).strict()).min(1),
  })
  .strict();

function assertDirection(
  rows: SessionCreditIdentity[],
  agreement: SessionCreditAgreement,
) {
  if (!rows.length)
    throw new ConflictException("SESSION_CREDIT_SNAPSHOT_INVALID");
  const { participantAId, participantBId } = agreement;
  for (const [i, item] of rows.entries()) {
    const learnerId =
      item.teacherId === participantAId ? participantBId : participantAId;
    if (
      item.learnerId !== learnerId ||
      item.planId !== rows[0]!.planId ||
      item.planVersion !== rows[0]!.planVersion ||
      item.outlineSessionNo !== i + 1 ||
      (agreement.exchangeType === "ONE_WAY" &&
        item.learnerId !== agreement.learnerId)
    )
      throw new ConflictException("SESSION_CREDIT_SNAPSHOT_INVALID");
  }
}

export function createSessionCreditSnapshot(
  total: bigint,
  agreement: SessionCreditAgreement,
  sessions: readonly SessionCreditIdentity[],
  ownerId?: string,
) {
  const { participantAId, participantBId } = agreement;
  const ordered = sessions
    .map((item) => identity.parse(item))
    .sort(
      (a, b) =>
        Number(b.teacherId === participantAId) -
          Number(a.teacherId === participantAId) ||
        a.outlineSessionNo - b.outlineSessionNo,
    );
  const teacherIds =
    agreement.exchangeType === "TWO_WAY"
      ? [participantAId, participantBId]
      : [agreement.teacherId];
  const directions = teacherIds.map((teacherId) =>
    ordered.filter((item) => item.teacherId === teacherId),
  );
  if (
    total <= 0n ||
    total > MAX_CREDIT_UNITS ||
    participantAId === participantBId ||
    teacherIds.some((id) => id !== participantAId && id !== participantBId) ||
    new Set(ordered.map((item) => item.id)).size !== ordered.length ||
    new Set(ordered.map((item) => item.planId)).size !== teacherIds.length ||
    directions.flat().length !== ordered.length
  )
    throw new ConflictException("SESSION_CREDIT_SNAPSHOT_INVALID");
  for (const rows of directions) assertDirection(rows, agreement);
  const twoWay = agreement.exchangeType === "TWO_WAY";
  if (twoWay && ownerId !== participantAId && ownerId !== participantBId)
    throw new ConflictException("SESSION_CREDIT_OWNER_REQUIRED");
  const own = twoWay
    ? ordered.filter((row) => row.teacherId === ownerId)
    : ordered;
  const count = BigInt(own.length);
  const quotient = total / count;
  const remainder = total % count;
  const ownIndex = new Map(own.map((row, index) => [row.id, index]));
  return {
    policy:
      agreement.exchangeType === "TWO_WAY"
        ? TWO_WAY_SESSION_POLICY
        : ONE_WAY_SESSION_POLICY,
    ...(twoWay ? { ownerId } : {}),
    feeBps: 400,
    totalUnits: String(total),
    participantAId,
    participantBId,
    sessions: ordered.map((item) => {
      let creditUnits = 0n;
      const index = ownIndex.get(item.id);
      if (index !== undefined) {
        creditUnits = quotient;
        if (BigInt(index) < remainder) creditUnits += 1n;
      }
      return { ...item, creditUnits: String(creditUnits) };
    }),
  };
}

export function calculateSessionCredit(
  snapshot: unknown,
  total: bigint,
  agreement: SessionCreditAgreement,
  live: readonly (SessionCreditIdentity & {
    status: string;
    teacherAbsentWithoutMakeup?: boolean;
  })[],
) {
  if (snapshot == null)
    throw new ConflictException("SESSION_CREDIT_SNAPSHOT_MISSING");
  const parsed = snapshotSchema.safeParse(snapshot);
  if (!parsed.success)
    throw new ConflictException("SESSION_CREDIT_SNAPSHOT_INVALID");
  const data = parsed.data;
  if (data.policy === "TWO_WAY_SESSION_V1")
    throw new ConflictException("SESSION_CREDIT_POLICY_REVIEW_REQUIRED");
  const expected = createSessionCreditSnapshot(
    total,
    agreement,
    data.sessions.map(
      ({
        id,
        planId,
        planVersion,
        outlineSessionNo,
        teacherId,
        learnerId,
      }) => ({
        id,
        planId,
        planVersion,
        outlineSessionNo,
        teacherId,
        learnerId,
      }),
    ),
    data.ownerId,
  );
  if (JSON.stringify(expected) !== JSON.stringify(data))
    throw new ConflictException("SESSION_CREDIT_SNAPSHOT_INVALID");
  const byId = new Map(live.map((item) => [item.id, item]));
  if (byId.size !== live.length || live.length !== data.sessions.length)
    throw new ConflictException("SESSION_CREDIT_SNAPSHOT_MISMATCH");
  const sessions = data.sessions.map((item) => {
    const current = byId.get(item.id);
    if (
      !current ||
      current.planId !== item.planId ||
      current.planVersion !== item.planVersion ||
      current.outlineSessionNo !== item.outlineSessionNo ||
      current.teacherId !== item.teacherId ||
      current.learnerId !== item.learnerId
    )
      throw new ConflictException("SESSION_CREDIT_SNAPSHOT_MISMATCH");
    return {
      ...item,
      status: current.status,
      teacherAbsentWithoutMakeup: current.teacherAbsentWithoutMakeup === true,
    };
  });
  const completedCredit = sessions.reduce(
    (sum, item) =>
      sum + (item.status === "COMPLETED" ? BigInt(item.creditUnits) : 0n),
    0n,
  );
  const compensationCredit = sessions.reduce(
    (sum, item) =>
      sum + (item.teacherAbsentWithoutMakeup ? BigInt(item.creditUnits) : 0n),
    0n,
  );
  const feeBasis =
    agreement.exchangeType === "TWO_WAY" ? total : completedCredit;
  const fee = (feeBasis * 400n) / 10_000n;
  return {
    sessions,
    completedCredit,
    uncompletedCredit: total - completedCredit,
    platformFee: fee,
    compensationCredit,
  };
}

/** Round the agreement's total fee once; distribute hundredths deterministically. */
export function allocateHeldFee(
  rows: readonly { userId: string; amount: bigint }[],
) {
  const ordered = [...rows].sort((a, b) =>
    a.userId < b.userId ? -1 : Number(a.userId > b.userId),
  );
  const total = ordered.reduce((sum, row) => sum + row.amount, 0n);
  if (total <= 0n) throw new ConflictException("INVALID_CREDIT_AMOUNT");
  const fee = (total * 400n) / 10_000n;
  const fees = ordered.map((row) => ({
    userId: row.userId,
    fee: (fee * row.amount) / total,
  }));
  let remainder = fee - fees.reduce((sum, row) => sum + row.fee, 0n);
  for (const row of fees) {
    if (remainder === 0n) break;
    row.fee += 1n;
    remainder -= 1n;
  }
  return new Map(fees.map((row) => [row.userId, row.fee]));
}
