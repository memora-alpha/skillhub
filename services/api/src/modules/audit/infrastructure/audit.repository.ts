import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "../../../generated/prisma/client";
import type { TransactionContext } from "../../../infrastructure/database/transaction-context";
import type { AuditInput } from "../application/audit.types";

@Injectable()
export class AuditRepository {
  async append(
    tx: TransactionContext,
    input: AuditInput,
  ): Promise<{ auditId: string }> {
    const auditId = randomUUID();
    // Unchecked input: the HUMAN actor is a users.id snapshot checked by the foreign key.
    const data: Prisma.AuditLogUncheckedCreateInput = {
      id: auditId,
      actorKind: input.actor.kind,
      actorId: input.actor.kind === "HUMAN" ? input.actor.userId : null,
      actorRoles: input.actor.kind === "HUMAN" ? [...input.actor.roles] : [],
      systemActor: input.actor.kind === "SYSTEM" ? input.actor.name : null,
      action: input.action,
      targetType: input.target.type,
      targetId: input.target.id,
      ...(input.before === undefined
        ? {}
        : { before: input.before as Prisma.InputJsonValue }),
      ...(input.after === undefined
        ? {}
        : { after: input.after as Prisma.InputJsonValue }),
      reason: input.reason,
      requestId: input.context.requestId,
      correlationId: input.context.correlationId,
    };
    await tx.auditLog.create({ data, select: { id: true } });
    return { auditId };
  }
}
