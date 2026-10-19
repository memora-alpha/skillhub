import { Injectable } from "@nestjs/common";
import { IdentityTx } from "../../../../shared/database/identity-transactions";
import {
  ReauthProof,
  RefreshSession,
  RefreshCredential,
} from "../../../../generated/prisma/client";
import { AuthRepository } from "../../application/ports/auth-repository";
@Injectable()
export class PrismaAuthRepository extends AuthRepository {
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
}
