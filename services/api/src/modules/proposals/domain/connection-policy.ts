import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";
import sanitizeHtml from "sanitize-html";

const positive = (fallback: number, max = 1_000_000_000) =>
  z.coerce.number().int().positive().max(max).default(fallback);
const settings = z
  .object({
    proposalTtlDays: positive(7, 365),
    proposalsPerHour: positive(10),
    proposalsPerDay: positive(50),
    directCooldownHours: positive(24, 8760),
    messagesPerMinuteUser: positive(30),
    messagesPerMinuteConversation: positive(120),
    filesPerMessage: positive(5, 5),
    fileMaxBytes: positive(15_000_000, 15_000_000),
    messageMaxBytes: positive(50_000_000, 50_000_000),
    sessionCountMax: z.coerce.number().int().min(1).max(32767).optional(),
    oneWayMin: z
      .string()
      .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
      .refine((value) => creditUnits(value) > 0n)
      .optional(),
    oneWayMax: z
      .string()
      .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/)
      .refine((value) => creditUnits(value) > 0n)
      .optional(),
  })
  .refine(
    (value) =>
      !value.oneWayMin ||
      !value.oneWayMax ||
      creditUnits(value.oneWayMin) <= creditUnits(value.oneWayMax),
    "Invalid ONE_WAY hint range",
  );
export type ConnectionSettings = z.infer<typeof settings>;
export function connectionSettings(value: unknown): ConnectionSettings {
  return settings.parse(value);
}
export function creditUnits(value: string): bigint {
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value))
    throw new BadRequestException("INVALID_CREDIT_HINT");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export type ProposalHints = {
  message: string;
  exchangeTypeHint?: "ONE_WAY" | "TWO_WAY" | null;
  proposedCredit?: string | null;
  proposedDurationMinutes?: number | null;
  initialSessionCount?: number | null;
  candidateSlots?: { startAt: string; endAt: string }[];
};
export function plainText(value: string, min: number, max: number) {
  if (typeof value !== "string") throw new BadRequestException("INVALID_TEXT");
  const text = sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .normalize("NFC")
    .trim();
  if (
    [...text].length < min ||
    [...text].length > max ||
    [...text].some(
      (char) => char.codePointAt(0)! < 32 && !["\t", "\n", "\r"].includes(char),
    )
  )
    throw new BadRequestException("INVALID_TEXT");
  return text;
}
export function normalizeProposal(
  input: ProposalHints,
  policy: ConnectionSettings,
  now = new Date(),
) {
  const message = plainText(input.message, 10, 1000);
  const duration = input.proposedDurationMinutes ?? null;
  if (
    duration !== null &&
    (!Number.isInteger(duration) || duration < 60 || duration > 180)
  )
    throw new BadRequestException("INVALID_DURATION_HINT");
  const readSessionCount = () => {
    const count = input.initialSessionCount ?? null;
    if (count !== null) {
      if (!policy.sessionCountMax)
        throw new ServiceUnavailableException("CONNECTION_POLICY_UNAVAILABLE");
      if (
        !Number.isInteger(count) ||
        count < 1 ||
        count > policy.sessionCountMax
      )
        throw new BadRequestException("INVALID_SESSION_COUNT_HINT");
    }

    return count;
  };
  const count = readSessionCount();
  const exchangeTypeHint = input.exchangeTypeHint ?? null;
  if (
    exchangeTypeHint !== null &&
    !["ONE_WAY", "TWO_WAY"].includes(exchangeTypeHint)
  )
    throw new BadRequestException("INVALID_EXCHANGE_HINT");
  const proposedCredit =
    input.proposedCredit === undefined || input.proposedCredit === null
      ? null
      : creditUnits(input.proposedCredit);
  const validateCreditHint = () => {
    if (proposedCredit !== null) {
      if (
        !exchangeTypeHint ||
        proposedCredit <= 0n ||
        (exchangeTypeHint === "TWO_WAY" && proposedCredit < 2000n)
      )
        throw new BadRequestException("INVALID_CREDIT_HINT");
      if (exchangeTypeHint === "ONE_WAY") {
        if (!policy.oneWayMin || !policy.oneWayMax)
          throw new ServiceUnavailableException(
            "CONNECTION_POLICY_UNAVAILABLE",
          );
        if (
          proposedCredit < creditUnits(policy.oneWayMin) ||
          proposedCredit > creditUnits(policy.oneWayMax)
        )
          throw new BadRequestException("INVALID_CREDIT_HINT");
      }
    }
  };
  validateCreditHint();
  const candidateSlots = input.candidateSlots ?? [];
  if (
    candidateSlots.length > 5 ||
    candidateSlots.some(
      (slot) =>
        !slot.startAt.endsWith("Z") ||
        !slot.endAt.endsWith("Z") ||
        !Number.isFinite(Date.parse(slot.startAt)) ||
        !Number.isFinite(Date.parse(slot.endAt)) ||
        Date.parse(slot.startAt) <= now.getTime() ||
        Date.parse(slot.endAt) <= Date.parse(slot.startAt),
    )
  )
    throw new BadRequestException("INVALID_CANDIDATE_SLOTS");
  return {
    message,
    exchangeTypeHint,
    proposedCredit,
    proposedDurationMinutes: duration,
    initialSessionCount: count,
    candidateSlots,
  };
}
export { formatCredit } from "../../credit/domain/money";
export function normalizeMessage(input: {
  messageText?: string;
  attachmentFileIds?: string[];
}) {
  const messageText =
    input.messageText === undefined
      ? ""
      : plainText(input.messageText, 0, 2000);
  // Keep the existing code-unit order so persisted command digests remain stable,
  // including UUIDs supplied with mixed casing.
  const attachmentFileIds = [...(input.attachmentFileIds ?? [])].sort(
    (a, b) => {
      if (a === b) return 0;
      return a < b ? -1 : 1;
    },
  );
  if (
    attachmentFileIds.length > 5 ||
    new Set(attachmentFileIds).size !== attachmentFileIds.length ||
    (!messageText && !attachmentFileIds.length)
  )
    throw new BadRequestException("INVALID_MESSAGE");
  return { messageText, attachmentFileIds };
}
