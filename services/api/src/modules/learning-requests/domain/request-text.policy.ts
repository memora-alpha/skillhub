import { BadRequestException } from "@nestjs/common";
import { decode } from "html-entities";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { normalizeTagLabel } from "../../skills/domain/tag-policy";
import {
  preferredAvailabilitySchema,
  hourlyCreditSchema,
  type PreferredAvailability,
} from "./request-preferences.policy";

const DAY_MS = 24 * 60 * 60 * 1000;
const uuidSchema = z.uuid();
const levelSchema = z.enum(["NONE", "BEGINNER", "INTERMEDIATE", "ADVANCED"]);
const slotInputSchema = z.strictObject({
  startAt: z.iso.datetime({ offset: true }),
  endAt: z.iso.datetime({ offset: true }),
});
const requestShape = z.strictObject({
  title: z.string(),
  skillId: uuidSchema,
  description: z.string(),
  learningGoal: z.string(),
  teachingOverview: z.string().nullable().optional(),
  offeredSharingSkillIds: z
    .array(uuidSchema.transform((id) => id.toLowerCase()))
    .max(10)
    .refine((ids) => new Set(ids).size === ids.length)
    .optional(),
  preferredAvailability: preferredAvailabilitySchema.nullable().optional(),
  desiredCreditPerHour: hourlyCreditSchema.nullable().optional(),
  currentLevel: levelSchema.nullable().optional(),
  verifiedTeacherOnly: z.boolean().optional(),
  tagIds: z
    .array(uuidSchema)
    .max(10)
    .refine((ids) => new Set(ids).size === ids.length)
    .optional(),
  proposedTags: z
    .array(z.string().transform((value) => normalizeTagLabel(value).label))
    .max(10)
    .refine(
      (labels) =>
        new Set(labels.map((label) => normalizeTagLabel(label).labelKey))
          .size === labels.length,
    )
    .optional(),
  preferredSlots: z.array(slotInputSchema).max(5).optional(),
  expiresAt: z.iso.datetime({ offset: true }).nullable().optional(),
});

export type LearningRequestInput = z.input<typeof requestShape>;
export type PreparedLearningRequestContent = {
  title: string;
  skillId: string;
  description: string;
  learningGoal: string;
  teachingOverview: string | null;
  offeredSharingSkillIds: string[];
  preferredAvailability: PreferredAvailability | null;
  desiredCreditPerHour: bigint | null;
  currentLevel: "NONE" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  verifiedTeacherOnly: boolean;
  tagIds: string[];
  proposedTags: string[];
  preferredSlots: { startAt: Date; endAt: Date }[];
  requestedExpiresAt: Date | null;
};

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: "discard",
  nonTextTags: ["script", "style", "textarea", "option", "noscript"],
};

/** Sanitizes HTML on the server and stores decoded plain text as JSON-safe data. */
export function sanitizeLearningRequestText(input: string): string {
  const sanitized = sanitizeHtml(input, sanitizeOptions);
  return decode(sanitized, { level: "html5" }).normalize("NFKC").trim();
}

function assertLength(value: string, min: number, max: number): void {
  const length = [...value].length;
  if (length < min || length > max) {
    throw new BadRequestException("INVALID_REQUEST_INPUT");
  }
}

function parseDate(value: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new BadRequestException("INVALID_REQUEST_INPUT");
  }
  return parsed;
}

export function prepareLearningRequestContent(
  input: unknown,
  now: Date,
): PreparedLearningRequestContent {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError("A valid current time is required");
  }
  try {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new TypeError("invalid request input");
    }
    const raw = input as Record<string, unknown>;
    const parsed = requestShape.parse({
      ...raw,
      title:
        typeof raw.title === "string"
          ? sanitizeLearningRequestText(raw.title)
          : raw.title,
      description:
        typeof raw.description === "string"
          ? sanitizeLearningRequestText(raw.description)
          : raw.description,
      learningGoal:
        typeof raw.learningGoal === "string"
          ? sanitizeLearningRequestText(raw.learningGoal)
          : raw.learningGoal,
      teachingOverview:
        typeof raw.teachingOverview === "string"
          ? sanitizeLearningRequestText(raw.teachingOverview)
          : raw.teachingOverview,
    });
    assertLength(parsed.title, 10, 120);
    assertLength(parsed.description, 20, 3000);
    assertLength(parsed.learningGoal, 10, 1000);
    if (
      (parsed.tagIds?.length ?? 0) + (parsed.proposedTags?.length ?? 0) >
      10
    ) {
      throw new BadRequestException("INVALID_REQUEST_INPUT");
    }
    if (parsed.teachingOverview != null)
      assertLength(parsed.teachingOverview, 20, 3000);
    if (
      parsed.preferredSlots?.length &&
      parsed.preferredAvailability?.weeklySlots.length
    ) {
      throw new BadRequestException("INVALID_REQUEST_INPUT");
    }

    const preferredSlots = (parsed.preferredSlots ?? []).map((slot) => {
      const startAt = parseDate(slot.startAt);
      const endAt = parseDate(slot.endAt);
      if (startAt <= now || endAt <= startAt) {
        throw new BadRequestException("INVALID_REQUEST_INPUT");
      }
      return { startAt, endAt };
    });
    const requestedExpiresAt = parsed.expiresAt
      ? parseDate(parsed.expiresAt)
      : null;
    if (requestedExpiresAt && requestedExpiresAt <= now) {
      throw new BadRequestException("INVALID_REQUEST_INPUT");
    }
    return {
      title: parsed.title,
      skillId: parsed.skillId,
      description: parsed.description,
      learningGoal: parsed.learningGoal,
      teachingOverview: parsed.teachingOverview ?? null,
      offeredSharingSkillIds: [...(parsed.offeredSharingSkillIds ?? [])].sort(
        (left, right) => left.localeCompare(right),
      ),
      preferredAvailability: parsed.preferredAvailability ?? null,
      desiredCreditPerHour: parsed.desiredCreditPerHour ?? null,
      currentLevel: parsed.currentLevel ?? null,
      verifiedTeacherOnly: parsed.verifiedTeacherOnly ?? false,
      tagIds: parsed.tagIds ?? [],
      proposedTags: parsed.proposedTags ?? [],
      preferredSlots,
      requestedExpiresAt,
    };
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException("INVALID_REQUEST_INPUT");
  }
}

/** Rechecks the caller-selected deadline against the authoritative publish time. */
export function validateExpiryAtPublish(
  requestedExpiresAt: Date | null,
  publishedAt: Date,
): Date {
  if (!Number.isFinite(publishedAt.getTime())) {
    throw new TypeError("A valid publish time is required");
  }
  const expiresAt =
    requestedExpiresAt ?? new Date(publishedAt.getTime() + 30 * DAY_MS);
  if (
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt <= publishedAt ||
    expiresAt.getTime() > publishedAt.getTime() + 90 * DAY_MS
  ) {
    throw new BadRequestException("INVALID_REQUEST_INPUT");
  }
  return expiresAt;
}
