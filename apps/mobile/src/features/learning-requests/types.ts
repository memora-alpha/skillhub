import { z } from "zod";
import { proposedTagsSchema } from "./schemas/request-tags";
import {
  cardPreferences,
  idsSchema,
  offeringSchema,
} from "./schemas/request-preferences";
export const requestStatuses = [
  "DRAFT",
  "PENDING_MODERATION",
  "OPEN",
  "REJECTED",
  "NEGOTIATING",
  "MATCHED",
  "CLOSED",
  "CANCELLED",
  "EXPIRED",
] as const;
export const requestLevels = [
  "NONE",
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
] as const;
export const slotSchema = z.object({
  startAt: z.iso.datetime({ offset: true }),
  endAt: z.iso.datetime({ offset: true }),
});
const base = {
  ...cardPreferences,
  id: z.uuid(),
  title: z.string(),
  learningGoal: z.string(),
  currentLevel: z.enum(requestLevels).nullable(),
  verifiedTeacherOnly: z.boolean(),
  status: z.enum(requestStatuses),
  createdAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
};
export const ownerSchema = z.object({
  ...base,
  skillId: z.uuid(),
  description: z.string(),
  tagIds: z.array(z.uuid()),
  proposedTags: proposedTagsSchema.default([]),
  offeredSharingSkillIds: idsSchema.default([]),
  preferredSlots: z.array(slotSchema),
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  moderationStatus: z.enum(["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"]),
  moderationRejectReason: z.string().nullable(),
  effectiveStatus: z.enum(requestStatuses).optional(),
  requestedExpiresAt: z.iso.datetime({ offset: true }).nullable(),
  publishedAt: z.iso.datetime({ offset: true }).nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
});
export const publicSchema = z.object({
  ...base,
  description: z.string().optional(),
  preferredSlots: z.array(slotSchema).default([]),
  skill: z.object({ id: z.uuid(), name: z.string() }),
  tags: z.array(z.object({ id: z.uuid(), label: z.string() })),
  owner: z.object({ id: z.uuid(), displayName: z.string() }),
  matchScore: z.number().optional(),
});
export const publicDetailSchema = publicSchema.extend({
  description: z.string(),
  preferredSlots: z.array(slotSchema),
  version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
export const skillSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]),
});
export const tagSchema = z.object({ id: z.uuid(), label: z.string() });
export const ownOfferingSchema = offeringSchema.extend({
  skill: skillSchema,
  isVisible: z.boolean(),
  archivedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type TagOption = z.infer<typeof tagSchema>;
export type OwnOffering = z.infer<typeof ownOfferingSchema>;
export type OwnerRequest = z.infer<typeof ownerSchema>;
export type PublicRequest = z.infer<typeof publicSchema>;
export type PublicRequestDetail = z.infer<typeof publicDetailSchema>;
export type RequestItem = OwnerRequest | PublicRequest;
export type SkillOption = z.infer<typeof skillSchema>;
export type RequestInput = {
  teachingOverview?: string | null;
  offeredSharingSkillIds?: string[];
  preferredAvailability?: OwnerRequest["preferredAvailability"];
  desiredCreditPerHour?: string | null;
  tagIds?: string[];
  proposedTags?: string[];
  title: string;
  skillId: string;
  description: string;
  learningGoal: string;
  currentLevel: OwnerRequest["currentLevel"];
  verifiedTeacherOnly: boolean;
  preferredSlots: OwnerRequest["preferredSlots"];
  expiresAt: string | null;
};
export type RequestPatch = Partial<RequestInput> & { expectedVersion: number };
export type RequestFilters = {
  keyword?: string;
  skillId?: string;
  status?: string;
  tagIds?: string[];
};
export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};
