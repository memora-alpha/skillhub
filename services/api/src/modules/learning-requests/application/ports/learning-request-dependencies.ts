import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";

export const NEW_ACTIVITY_ELIGIBILITY_READER = Symbol(
  "NEW_ACTIVITY_ELIGIBILITY_READER",
);
export const SKILL_CATALOG_READER = Symbol("SKILL_CATALOG_READER");
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
  ): Promise<{ id: string; displayName: string }[]>;
}

export interface SharingSkillReader {
  getMatchingSnapshot(
    tx: TransactionContext,
    userId: string,
  ): Promise<{
    skillIds: readonly string[];
    tagIds: readonly string[];
    version: string;
  }>;
}
