import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { TransactionContext } from "../../infrastructure/database/transaction-context";
import { TransactionRunner } from "../../infrastructure/database/transaction-runner";
import {
  SessionsService,
  type Principal,
} from "../auth/application/services/sessions.service";

@Injectable()
export class DashboardSnapshot {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly sessions: SessionsService,
  ) {}

  read<T extends Record<string, unknown>>(
    actor: Principal,
    permissions: readonly string[],
    read: (tx: TransactionContext, asOf: Date) => T | Promise<T>,
  ) {
    return this.transactions.run(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const principal = await this.sessions.assertLive(tx, actor);
      if (
        !principal.roles.includes("ADMIN") ||
        !["dashboard:read", ...permissions].every((permission) =>
          principal.permissions.includes(permission),
        )
      )
        throw new ForbiddenException("DASHBOARD_PERMISSION_REQUIRED");

      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT CURRENT_TIMESTAMP AS now`;
      if (!(clock?.now instanceof Date))
        throw new ServiceUnavailableException("DATABASE_TIME_UNAVAILABLE");
      return { ...(await read(tx, clock.now)), asOf: clock.now };
    });
  }
}
