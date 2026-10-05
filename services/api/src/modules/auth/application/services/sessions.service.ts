import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "node:crypto";
import { IdentityConfig } from "../../../../configs/identity.config";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { IdentityTx } from "../../../../shared/database/identity-transactions";
import { UsersService } from "../../../users/application/services/users.service";
import { AuthRepository } from "../ports/auth-repository";
import { User } from "../../../../generated/prisma/client";
export type Principal = {
  userId: string;
  sessionId: string;
  securityVersion: number;
  roles: string[];
  permissions: string[];
};
@Injectable()
export class SessionsService {
  private readonly jwt = new JwtService();
  constructor(
    private readonly db: PrismaService,
    private readonly config: IdentityConfig,
    private readonly users: UsersService,
    private readonly repository: AuthRepository,
  ) {}
  async issue(tx: IdentityTx, user: User, rememberMe: boolean) {
    const absoluteExpiresAt = new Date(
      Date.now() +
        (rememberMe
          ? this.config.rememberSeconds
          : this.config.refreshSeconds) *
          1000,
    );
    const session = await this.repository.createSession(tx, {
      userId: user.id,
      securityVersion: user.securityVersion,
      rememberMe,
      absoluteExpiresAt,
    });
    return this.pair(tx, user, session.id, 0, absoluteExpiresAt);
  }
  async pair(
    tx: IdentityTx,
    user: User,
    sessionId: string,
    generation: number,
    expiresAt: Date,
  ) {
    const refreshToken = this.config.crypto.secret();
    await this.repository.createCredential(tx, {
      sessionId,
      generation,
      tokenDigest: this.config.crypto.secretDigest(refreshToken),
      expiresAt,
    });
    const accessToken = await this.jwt.signAsync(
      { sid: sessionId, sv: user.securityVersion, type: "access" },
      {
        secret: this.config.jwtKey,
        algorithm: "HS256",
        subject: user.id,
        jwtid: randomUUID(),
        issuer: this.config.issuer,
        audience: this.config.audience,
        expiresIn: this.config.accessSeconds,
      },
    );
    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: this.config.accessSeconds,
      refreshExpiresAt: expiresAt.toISOString(),
    };
  }
  async revoke(tx: IdentityTx, userId: string, reason: string) {
    await this.repository.revokeUser(tx, userId, reason);
  }
  async principal(token: string, tx: IdentityTx = this.db): Promise<Principal> {
    let claims: {
      sub: string;
      sid: string;
      sv: number;
      type: string;
      exp: number;
      iat: number;
      jti: string;
    };
    try {
      claims = await this.jwt.verifyAsync(token, {
        secret: this.config.jwtKey,
        algorithms: ["HS256"],
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
      if (
        claims.type !== "access" ||
        !/^[0-9a-f-]{36}$/i.test(claims.sub) ||
        !/^[0-9a-f-]{36}$/i.test(claims.sid) ||
        !Number.isSafeInteger(claims.sv) ||
        !claims.exp ||
        !claims.iat ||
        !claims.jti
      )
        throw new Error("Invalid access token claims");
    } catch {
      throw new UnauthorizedException();
    }
    const user = await this.users.byId(tx, claims.sub);
    const family = await this.repository.session(tx, claims.sid);
    if (
      !this.users.isActive(user) ||
      family?.userId !== claims.sub ||
      family.revokedAt ||
      family.absoluteExpiresAt <= new Date() ||
      family.securityVersion !== claims.sv ||
      user.securityVersion !== claims.sv
    )
      throw new UnauthorizedException();
    return {
      userId: user.id,
      sessionId: family.id,
      securityVersion: user.securityVersion,
      ...(await this.users.grants(tx, user.id)),
    };
  }
  async assertLive(tx: IdentityTx, principal: Principal): Promise<Principal> {
    const user = await this.users.byId(tx, principal.userId);
    const session = await this.repository.session(tx, principal.sessionId);
    if (
      !this.users.isActive(user) ||
      !session ||
      session.userId !== user.id ||
      session.revokedAt ||
      session.absoluteExpiresAt <= new Date() ||
      user.securityVersion !== principal.securityVersion ||
      session.securityVersion !== user.securityVersion
    )
      throw new UnauthorizedException();
    return { ...principal, ...(await this.users.grants(tx, user.id)) };
  }
}
