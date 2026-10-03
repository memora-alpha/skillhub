import { Injectable } from "@nestjs/common";

import { IdentityConfig } from "../../../../configs/identity.config";
import { IdentityTx } from "../../../../shared/database/identity-transactions";
import { User } from "../../../../generated/prisma/client";

import { UsersRepository } from "../ports/users-repository";
import { UserListQuery } from "../contracts/user-list-query";
@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly config: IdentityConfig,
  ) {}
  byEmail(tx: IdentityTx, normalizedEmail: string) {
    return this.repository.byEmail(tx, normalizedEmail);
  }
  byId(tx: IdentityTx, id: string) {
    return this.repository.byId(tx, id);
  }
  create(
    tx: IdentityTx,
    data: {
      email: string;
      fullName: string;
      passwordHash: string;
      timezone?: string;
      locale?: "vi" | "en";
    },
  ) {
    return this.repository.create(tx, {
      ...data,
      termsVersion: this.config.termsVersion,
      timezone: data.timezone ?? this.config.timezone,
      reputationScore: this.config.initialReputation,
    });
  }
  activate(tx: IdentityTx, id: string) {
    return this.repository.activate(tx, id);
  }
  loginSuccess(tx: IdentityTx, id: string) {
    return this.repository.loginSuccess(tx, id);
  }
  loginFailure(tx: IdentityTx, id: string) {
    return this.repository.loginFailure(tx, id);
  }
  password(tx: IdentityTx, id: string, hash: string) {
    return this.repository.password(tx, id, hash);
  }
  status(tx: IdentityTx, id: string, status: "ACTIVE" | "LOCKED") {
    return this.repository.status(tx, id, status);
  }
  role(
    tx: IdentityTx,
    userId: string,
    code: "STAFF" | "ADMIN",
    add: boolean,
    assignedBy: string | null,
  ) {
    return this.repository.role(tx, userId, code, add, assignedBy);
  }
  grants(tx: IdentityTx, userId: string) {
    return this.repository.grants(tx, userId);
  }
  list(tx: IdentityTx, query: UserListQuery) {
    return this.repository.list(tx, query);
  }
  isActive(user: User | null): user is User {
    return !!user && user.accountStatus === "ACTIVE" && user.emailVerified;
  }
}
