import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import type { RoleCode } from "../../../../shared/authorization/authorization.types";
import type { Principal } from "../../../auth/application/services/sessions.service";
import type { AuditWriter } from "../../../audit/application/services/audit-writer";
import {
  reportedSessionIds,
  WHITEBOARD_HOLD_REPORT_STATUSES,
} from "../../domain/whiteboard.policy";

/** Staff review of Session evidence (spec 019 P2, spec 020 D10). */
export const STAFF_REVIEW_PERMISSION = "report:moderate";

const openStatuses: readonly string[] = WHITEBOARD_HOLD_REPORT_STATUSES;

export function requireStaffReviewer(actor: Principal) {
  if (
    !actor.permissions.includes(STAFF_REVIEW_PERMISSION) ||
    (!actor.roles.includes("STAFF") && !actor.roles.includes("ADMIN"))
  )
    throw new ForbiddenException("STAFF_ACCESS_REQUIRED");
}

/**
 * The caller handles an open case that targets the Session or has it as
 * relatedSessionId. Checked in this order so each refusal names its cause.
 */
export async function requireOpenCaseForSession(
  tx: Pick<TransactionContext, "reportCase">,
  actor: Principal,
  sessionId: string,
  caseId: string,
) {
  const item = await tx.reportCase.findUnique({
    where: { id: caseId },
    select: {
      handlerId: true,
      status: true,
      relatedSessionId: true,
      targetType: true,
      targetId: true,
    },
  });
  if (!item) throw new NotFoundException("REPORT_CASE_NOT_FOUND");
  if (item.handlerId !== actor.userId)
    throw new ForbiddenException("REPORT_CASE_NOT_ASSIGNED_TO_CALLER");
  if (!openStatuses.includes(item.status))
    throw new ConflictException("REPORT_CASE_NOT_OPEN");
  if (!reportedSessionIds(item).includes(sessionId))
    throw new NotFoundException("SESSION_NOT_IN_REPORT_CASE");
}

/** One REPORT_EVIDENCE_READ entry, written in the transaction that grants the read. */
export async function appendEvidenceRead(
  audit: AuditWriter,
  tx: TransactionContext,
  actor: Principal,
  input: {
    targetType: "SESSION_WHITEBOARD" | "SESSION_RECORDING";
    targetId: string;
    caseId: string;
    reason: string;
  },
) {
  await audit.append(tx, {
    actor: {
      kind: "HUMAN",
      userId: actor.userId,
      roles: actor.roles.filter(
        (role): role is RoleCode =>
          role === "USER" || role === "STAFF" || role === "ADMIN",
      ),
    },
    action: "REPORT_EVIDENCE_READ",
    target: { type: input.targetType, id: input.targetId },
    after: { caseId: input.caseId, access: "READ" },
    reason: input.reason,
    context: { requestId: randomUUID(), correlationId: randomUUID() },
  });
}
