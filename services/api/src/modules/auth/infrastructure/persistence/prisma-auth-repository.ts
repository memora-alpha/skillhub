import { Injectable } from "@nestjs/common";
import { IdentityTx } from "../../../../shared/database/identity-transactions";
import {
  OtpChallenge,
  OtpIssueWindow,
  OtpPurpose,
  ReauthProof,
  RefreshSession,
  RefreshCredential,
} from "../../../../generated/prisma/client";
import { AuthRepository } from "../../application/ports/auth-repository";
@Injectable()
export class PrismaAuthRepository extends AuthRepository {
  latestIssue(
    tx: IdentityTx,
    email: string,
    purpose: OtpPurpose,
  ): Promise<OtpIssueWindow | null> {
    return tx.otpIssueWindow.findFirst({
      where: { normalizedEmail: email, purpose },
      orderBy: { lastIssuedAt: "desc" },
    });
  }
  issueWindow(
    tx: IdentityTx,
    email: string,
    purpose: OtpPurpose,
    windowStart: Date,
  ): Promise<OtpIssueWindow | null> {
    return tx.otpIssueWindow.findUnique({
      where: {
        normalizedEmail_purpose_windowStart: {
          normalizedEmail: email,
          purpose,
          windowStart,
        },
      },
    });
  }
  recordIssue(
    tx: IdentityTx,
    email: string,
    purpose: OtpPurpose,
    windowStart: Date,
    now: Date,
    resend: boolean,
  ): Promise<OtpIssueWindow> {
    return tx.otpIssueWindow.upsert({
      where: {
        normalizedEmail_purpose_windowStart: {
          normalizedEmail: email,
          purpose,
          windowStart,
        },
      },
      create: {
        normalizedEmail: email,
        purpose,
        windowStart,
        issueCount: 1,
        resendCount: resend ? 1 : 0,
        lastIssuedAt: now,
      },
      update: {
        issueCount: { increment: 1 },
        resendCount: { increment: resend ? 1 : 0 },
        lastIssuedAt: now,
      },
    });
  }
  supersedeChallenges(
    tx: IdentityTx,
    userId: string,
    purpose: OtpPurpose,
    now: Date,
  ): Promise<{ count: number }> {
    return tx.otpChallenge.updateMany({
      where: { userId, purpose, consumedAt: null, supersededAt: null },
      data: { supersededAt: now },
    });
  }
  createChallenge(
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
  ): Promise<OtpChallenge> {
    return tx.otpChallenge.create({ data });
  }
  activeChallenge(
    tx: IdentityTx,
    userId: string,
    purpose: OtpPurpose,
  ): Promise<OtpChallenge | null> {
    return tx.otpChallenge.findFirst({
      where: { userId, purpose, consumedAt: null, supersededAt: null },
      orderBy: { createdAt: "desc" },
    });
  }
  failChallenge(tx: IdentityTx, id: string): Promise<OtpChallenge> {
    return tx.otpChallenge.update({
      where: { id },
      data: { failedAttempts: { increment: 1 } },
    });
  }
  consumeChallenge(tx: IdentityTx, id: string): Promise<OtpChallenge> {
    return tx.otpChallenge.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }
  createProof(
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
  ): Promise<ReauthProof> {
    return tx.reauthProof.create({ data });
  }
  proof(
    tx: IdentityTx,
    digest: Uint8Array<ArrayBuffer>,
  ): Promise<ReauthProof | null> {
    return tx.reauthProof.findUnique({ where: { digest } });
  }
  consumeProof(tx: IdentityTx, id: string): Promise<ReauthProof> {
    return tx.reauthProof.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }
  createSession(
    tx: IdentityTx,
    data: Pick<
      RefreshSession,
      "userId" | "securityVersion" | "rememberMe" | "absoluteExpiresAt"
    >,
  ): Promise<RefreshSession> {
    return tx.refreshSession.create({
      data: { ...data, currentGeneration: 0 },
    });
  }
  createCredential(
    tx: IdentityTx,
    data: Pick<
      RefreshCredential,
      "sessionId" | "generation" | "tokenDigest" | "expiresAt"
    >,
  ): Promise<RefreshCredential> {
    return tx.refreshCredential.create({ data });
  }
  revokeUser(
    tx: IdentityTx,
    userId: string,
    reason: string,
  ): Promise<{ count: number }> {
    return tx.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }
  async credential(
    tx: IdentityTx,
    tokenDigest: Uint8Array<ArrayBuffer>,
  ): Promise<(RefreshCredential & { session: RefreshSession }) | null> {
    const row = await tx.refreshCredential.findUnique({
      where: { tokenDigest },
      include: { sessionIdRecord: true },
    });
    return row ? { ...row, session: row.sessionIdRecord } : null;
  }
  async requiredCredential(
    tx: IdentityTx,
    tokenDigest: Uint8Array<ArrayBuffer>,
  ): Promise<RefreshCredential & { session: RefreshSession }> {
    const row = await tx.refreshCredential.findUniqueOrThrow({
      where: { tokenDigest },
      include: { sessionIdRecord: true },
    });
    return { ...row, session: row.sessionIdRecord };
  }
  revokeFamily(
    tx: IdentityTx,
    id: string,
    reason: string,
  ): Promise<RefreshSession> {
    return tx.refreshSession.update({
      where: { id },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }
  consumeCredential(tx: IdentityTx, id: string): Promise<RefreshCredential> {
    return tx.refreshCredential.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }
  advanceGeneration(tx: IdentityTx, id: string): Promise<RefreshSession> {
    return tx.refreshSession.update({
      where: { id },
      data: { currentGeneration: { increment: 1 } },
    });
  }
  logoutFamily(tx: IdentityTx, id: string): Promise<{ count: number }> {
    return tx.refreshSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "LOGOUT" },
    });
  }
  session(tx: IdentityTx, id: string): Promise<RefreshSession | null> {
    return tx.refreshSession.findUnique({ where: { id } });
  }

  challengeById(tx: IdentityTx, id: string): Promise<OtpChallenge | null> {
    return tx.otpChallenge.findUnique({ where: { id } });
  }
}
