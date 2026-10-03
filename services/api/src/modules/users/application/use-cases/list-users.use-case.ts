import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";

import { UsersService } from "../services/users.service";
import {
  Principal,
  SessionsService,
} from "../../../auth/application/services/sessions.service";

import { AccountStatus, RoleCode } from "../../../../generated/prisma/client";

function permitted(principal: Principal, permission: string, admin = false) {
  if (
    !principal.permissions.includes(permission) ||
    (admin && !principal.roles.includes("ADMIN"))
  )
    throw new ForbiddenException();
}
@Injectable()
export class ListUsersUseCase {
  constructor(
    private readonly db: PrismaService,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
  ) {}
  async execute(
    principal: Principal,
    query: {
      limit?: number;
      cursor?: string;
      status?: AccountStatus;
      role?: RoleCode;
    },
  ) {
    const live = await this.sessions.assertLive(this.db, principal);
    permitted(live, "users.read");
    const limit = query.limit ?? 20;
    let cursor: {
      date: string;
      id: string;
      status?: string;
      role?: string;
    } | null = null;
    if (query.cursor) {
      try {
        cursor = JSON.parse(Buffer.from(query.cursor, "base64url").toString());
        if (
          !cursor ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            cursor.id,
          ) ||
          !Number.isFinite(Date.parse(cursor.date)) ||
          cursor.status !== query.status ||
          cursor.role !== query.role
        )
          throw new Error();
      } catch {
        throw new BadRequestException("INVALID_CURSOR");
      }
    }
    const filter = {
      status: query.status,
      role: query.role,
      before: cursor
        ? { date: new Date(cursor.date), id: cursor.id }
        : undefined,
      take: limit + 1,
    };
    const rows = await this.users.list(this.db, filter);
    const items = rows.slice(0, limit).map((row) => ({
      userId: row.id,
      fullName: row.profile?.fullName ?? "",
      maskedEmail: row.normalizedEmail.replace(/^(.)(.*)(@.*)$/, "$1***$3"),
      accountStatus: row.accountStatus,
      roles: row.roles.map((grant) => grant.role.code),
      createdAt: row.createdAt.toISOString(),
    }));
    const last = rows[limit - 1];
    return {
      items,
      nextCursor:
        rows.length > limit && last
          ? Buffer.from(
              JSON.stringify({
                id: last.id,
                date: last.createdAt.toISOString(),
                status: query.status,
                role: query.role,
              }),
            ).toString("base64url")
          : null,
    };
  }
}
