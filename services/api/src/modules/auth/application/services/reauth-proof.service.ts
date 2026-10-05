import { Injectable, UnauthorizedException } from "@nestjs/common";

import { IdentityConfig } from "../../../../configs/identity.config";

import { IdentityTx } from "../../../../shared/database/identity-transactions";

import { Principal } from "../services/sessions.service";

import { AuthRepository } from "../ports/auth-repository";

@Injectable()
export class ReauthProofService {
  constructor(
    private readonly config: IdentityConfig,
    private readonly repository: AuthRepository,
  ) {}
  async consumeReauth(tx: IdentityTx, principal: Principal, token: string) {
    const proof = await this.repository.proof(
      tx,
      this.config.crypto.secretDigest(token),
    );
    if (
      proof?.userId !== principal.userId ||
      proof.sessionId !== principal.sessionId ||
      proof.securityVersion !== principal.securityVersion ||
      proof.purpose !== "STAFF_ROLE_CHANGE" ||
      proof.consumedAt ||
      proof.expiresAt <= new Date()
    )
      throw new UnauthorizedException("REAUTH_REQUIRED");
    await this.repository.consumeProof(tx, proof.id);
  }
}
