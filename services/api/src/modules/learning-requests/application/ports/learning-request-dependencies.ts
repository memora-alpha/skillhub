import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { Principal } from "../../../auth/application/services/sessions.service";
import type { RequestContext } from "../../../../shared/http/request-context";
import type { LearningRequestPublicOwner } from "../contracts/learning-request.types";

export const NEW_ACTIVITY_ELIGIBILITY_READER = Symbol(
  "NEW_ACTIVITY_ELIGIBILITY_READER",
);
export const SKILL_CATALOG_READER = Symbol("SKILL_CATALOG_READER");
export const REQUEST_TAG_APPROVER = Symbol("REQUEST_TAG_APPROVER");

export interface RequestTagApprover {
  approveForRequest(
    tx: TransactionContext,
    actor: Principal,
    labels: readonly string[],
    requestId: string,
    context: RequestContext,
  ): Promise<string[]>;
}
export const REQUEST_LOCK_READER = Symbol("REQUEST_LOCK_READER");
export const REQUEST_OWNER_READER = Symbol("REQUEST_OWNER_READER");
export const SHARING_SKILL_READER = Symbol("SHARING_SKILL_READER");

export type SkillSelection = {
  skillId: string;
  tags: { id: string; label: string }[];
};

export interface SkillCatalogReader {
  assertActiveSelection(
    tx: TransactionContext,
    selection: { skillId: string; tagIds: readonly string[] },
  ): Promise<SkillSelection>;
  readSelections(
    tx: TransactionContext,
    selection: {
      skillIds: readonly string[];
      tagIds: readonly string[];
    },
  ): Promise<{
    skills: { id: string; name: string }[];
    tags: { id: string; label: string }[];
  }>;
}

export type NewActivityAction =
  "CREATE_LEARNING_REQUEST" | "PUBLISH_LEARNING_REQUEST";

export interface NewActivityEligibilityReader {
  assertAllowed(
    tx: TransactionContext,
    userId: string,
    action: NewActivityAction,
  ): Promise<void>;
}

export interface RequestLockReader {
  assertNotLocked(tx: TransactionContext, requestId: string): Promise<void>;
}

export interface RequestOwnerReader {
  readPublicOwners(
    tx: TransactionContext,
    userIds: readonly string[],
  ): Promise<LearningRequestPublicOwner[]>;
}

export interface SharingSkillReader {
  assertRequestOfferings(
    tx: TransactionContext,
    userId: string,
    sharingSkillIds: readonly string[],
  ): Promise<void>;
  readRequestOfferings(
    tx: TransactionContext,
    sharingSkillIds: readonly string[],
  ): Promise<OfferedSharingSkill[]>;
  getMatchingSnapshot(
    tx: TransactionContext,
    userId: string,
  ): Promise<{
    skillIds: readonly string[];
    tagIds: readonly string[];
    version: string;
  }>;
}

export type OfferedSharingSkill = {
  id: string;
  ownerId: string;
  skill: { id: string; name: string };
  level: string;
  verificationStatus: string;
};
