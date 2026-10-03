import { IdentityTx } from "../../../../shared/database/identity-transactions";
import {
  OtpChallenge,
  OtpIssueWindow,
  OtpPurpose,
  ReauthProof,
  RefreshSession,
  RefreshCredential,
} from "../../../../generated/prisma/client";
export abstract class AuthRepository {
  abstract latestIssue(
    tx: IdentityTx,
    email: string,
    purpose: OtpPurpose,
  ): Promise<OtpIssueWindow | null>;
  abstract issueWindow(
    tx: IdentityTx,
    email: string,
    purpose: OtpPurpose,
    windowStart: Date,
  ): Promise<OtpIssueWindow | null>;
  abstract recordIssue(
    tx: IdentityTx,
    email: string,
    purpose: OtpPurpose,
    windowStart: Date,
    now: Date,
    resend: boolean,
  ): Promise<OtpIssueWindow>;
  abstract supersedeChallenges(
    tx: IdentityTx,
    userId: string,
    purpose: OtpPurpose,
    now: Date,
  ): Promise<{ count: number }>;
  abstract createChallenge(
    tx: IdentityTx,
    data: Pick<
      OtpChallenge,
      | "id"
      | "userId"
      | "email"
      | "purpose"
      | "expiresAt"
      | "verifierKeyId"
      | "verifierDigest"
    >,
  ): Promise<OtpChallenge>;
  abstract activeChallenge(
    tx: IdentityTx,
    userId: string,
    purpose: OtpPurpose,
  ): Promise<OtpChallenge | null>;
  abstract failChallenge(tx: IdentityTx, id: string): Promise<OtpChallenge>;
  abstract consumeChallenge(tx: IdentityTx, id: string): Promise<OtpChallenge>;
  abstract createProof(
    tx: IdentityTx,
    data: Pick<
      ReauthProof,
      | "userId"
      | "sessionId"
      | "securityVersion"
      | "purpose"
      | "digest"
      | "expiresAt"
    >,
  ): Promise<ReauthProof>;
  abstract proof(
    tx: IdentityTx,
    digest: Uint8Array<ArrayBuffer>,
  ): Promise<ReauthProof | null>;
  abstract consumeProof(tx: IdentityTx, id: string): Promise<ReauthProof>;
  abstract createSession(
    tx: IdentityTx,
    data: Pick<
      RefreshSession,
      "userId" | "securityVersion" | "rememberMe" | "absoluteExpiresAt"
    >,
  ): Promise<RefreshSession>;
  abstract createCredential(
    tx: IdentityTx,
    data: Pick<
      RefreshCredential,
      "sessionId" | "generation" | "tokenDigest" | "expiresAt"
    >,
  ): Promise<RefreshCredential>;
  abstract revokeUser(
    tx: IdentityTx,
    userId: string,
    reason: string,
  ): Promise<{ count: number }>;
  abstract credential(
    tx: IdentityTx,
    tokenDigest: Uint8Array<ArrayBuffer>,
  ): Promise<(RefreshCredential & { session: RefreshSession }) | null>;
  abstract requiredCredential(
    tx: IdentityTx,
    tokenDigest: Uint8Array<ArrayBuffer>,
  ): Promise<RefreshCredential & { session: RefreshSession }>;
  abstract revokeFamily(
    tx: IdentityTx,
    id: string,
    reason: string,
  ): Promise<RefreshSession>;
  abstract consumeCredential(
    tx: IdentityTx,
    id: string,
  ): Promise<RefreshCredential>;
  abstract advanceGeneration(
    tx: IdentityTx,
    id: string,
  ): Promise<RefreshSession>;
  abstract logoutFamily(tx: IdentityTx, id: string): Promise<{ count: number }>;
  abstract session(tx: IdentityTx, id: string): Promise<RefreshSession | null>;
  abstract challengeById(
    tx: IdentityTx,
    id: string,
  ): Promise<OtpChallenge | null>;
}
