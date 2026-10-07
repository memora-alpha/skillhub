import type { Prisma } from "../../../../generated/prisma/client";

export type LearningRequestRecord = Omit<
  Prisma.LearningRequestGetPayload<{ include: { tagLinks: true } }>,
  "preferredSlots" | "flaggedCategories"
> & {
  preferredSlots: PreferredSlotRecord[];
  flaggedCategories: string[];
};

type LearningRequestProjectionSource = Omit<
  LearningRequestRecord,
  "preferredSlots" | "tagLinks"
> & {
  preferredSlots: Pick<
    LearningRequestRecord["preferredSlots"][number],
    "startAt" | "endAt"
  >[];
  tagLinks: Pick<LearningRequestRecord["tagLinks"][number], "tagId">[];
};

export type LearningRequestOwnerDetail = {
  id: string;
  skillId: string;
  title: string;
  description: string;
  learningGoal: string;
  currentLevel: LearningRequestRecord["currentLevel"];
  verifiedTeacherOnly: boolean;
  tagIds: string[];
  preferredSlots: PreferredSlotRecord[];
  status: LearningRequestRecord["status"];
  moderationStatus: LearningRequestRecord["moderationStatus"];
  moderationRejectReason: string | null;
  version: number;
  requestedExpiresAt: Date | null;
  expiresAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LearningRequestModerationDetail = {
  id: string;
  ownerId: string;
  skillId: string;
  title: string;
  description: string;
  learningGoal: string;
  currentLevel: LearningRequestRecord["currentLevel"];
  verifiedTeacherOnly: boolean;
  tagIds: string[];
  preferredSlots: PreferredSlotRecord[];
  status: LearningRequestRecord["status"];
  moderationStatus: LearningRequestRecord["moderationStatus"];
  moderationRejectReason: string | null;
  flaggedCategories: string[];
  moderationReviewedVersion: number | null;
  moderatedByUserId: string | null;
  moderatedAt: Date | null;
  expiresAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type LearningRequestSummary = {
  id: string;
  title: string;
  skill: { id: string; name: string };
  tags: { id: string; label: string }[];
  learningGoal: string;
  currentLevel: LearningRequestRecord["currentLevel"];
  verifiedTeacherOnly: boolean;
  status: LearningRequestRecord["status"];
  owner: { id: string; displayName: string };
  createdAt: Date;
  expiresAt: Date | null;
};

export type LearningRequestDetail = LearningRequestSummary & {
  description: string;
  preferredSlots: PreferredSlotRecord[];
  version: number;
};

export type LearningRequestOwnerSummary = LearningRequestOwnerDetail & {
  effectiveStatus: LearningRequestRecord["status"];
};

export type LearningRequestListQuery = {
  skillId?: string;
  tagIds?: string[];
  keyword?: string;
  status?: LearningRequestRecord["status"];
  limit?: number;
  cursor?: string;
};

export type LearningRequestListScope =
  "FEED" | "MINE" | "MODERATION" | "RECOMMENDED";

export type LearningRequestPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export function toLearningRequestOwnerDetail(
  record: LearningRequestProjectionSource,
): LearningRequestOwnerDetail {
  return {
    id: record.id,
    skillId: record.skillId,
    title: record.title,
    description: record.description,
    learningGoal: record.learningGoal,
    currentLevel: record.currentLevel,
    verifiedTeacherOnly: record.verifiedTeacherOnly,
    tagIds: record.tagLinks.map((link) => link.tagId).sort(),
    preferredSlots: record.preferredSlots
      .map(({ startAt, endAt }) => ({ startAt, endAt }))
      .sort((left, right) => left.startAt.getTime() - right.startAt.getTime()),
    status: record.status,
    moderationStatus: record.moderationStatus,
    moderationRejectReason: record.moderationRejectReason,
    version: record.version,
    requestedExpiresAt: record.requestedExpiresAt,
    expiresAt: record.expiresAt,
    publishedAt: record.publishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toLearningRequestModerationDetail(
  record: LearningRequestProjectionSource,
): LearningRequestModerationDetail {
  return {
    id: record.id,
    ownerId: record.ownerId,
    skillId: record.skillId,
    title: record.title,
    description: record.description,
    learningGoal: record.learningGoal,
    currentLevel: record.currentLevel,
    verifiedTeacherOnly: record.verifiedTeacherOnly,
    tagIds: record.tagLinks.map((link) => link.tagId).sort(),
    preferredSlots: record.preferredSlots
      .map(({ startAt, endAt }) => ({ startAt, endAt }))
      .sort((left, right) => left.startAt.getTime() - right.startAt.getTime()),
    status: record.status,
    moderationStatus: record.moderationStatus,
    moderationRejectReason: record.moderationRejectReason,
    flaggedCategories: [...record.flaggedCategories],
    moderationReviewedVersion: record.moderationReviewedVersion,
    moderatedByUserId: record.moderatedByUserId,
    moderatedAt: record.moderatedAt,
    expiresAt: record.expiresAt,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export type PreferredSlotRecord = {
  startAt: Date;
  endAt: Date;
};

export type CreateLearningRequestRecord = {
  id?: string;
  ownerId: string;
  skillId: string;
  title: string;
  description: string;
  learningGoal: string;
  currentLevel: LearningRequestRecord["currentLevel"];
  verifiedTeacherOnly: boolean;
  tagIds: readonly string[];
  preferredSlots: readonly PreferredSlotRecord[];
  requestedExpiresAt: Date | null;
  expiryMode: LearningRequestRecord["expiryMode"];
};

export type ReplaceLearningRequestContent = Partial<
  Pick<
    LearningRequestRecord,
    | "skillId"
    | "title"
    | "description"
    | "learningGoal"
    | "currentLevel"
    | "verifiedTeacherOnly"
    | "requestedExpiresAt"
    | "expiresAt"
    | "expiryMode"
    | "status"
    | "moderationStatus"
    | "moderationRejectReason"
    | "flaggedCategories"
    | "moderationRuleSetVersion"
    | "moderationReviewedVersion"
    | "moderatedByUserId"
    | "moderatedAt"
  >
> & {
  tagIds?: readonly string[];
  preferredSlots?: readonly PreferredSlotRecord[];
};

export type LearningRequestTransition = Partial<
  Pick<
    LearningRequestRecord,
    | "status"
    | "moderationStatus"
    | "moderationRejectReason"
    | "flaggedCategories"
    | "moderationRuleSetVersion"
    | "moderationReviewedVersion"
    | "moderatedByUserId"
    | "moderatedAt"
    | "expiresAt"
    | "requestedExpiresAt"
    | "expiryMode"
    | "publishedAt"
  >
>;
