import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Prisma } from "../../../../generated/prisma/client";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { CLOCK, type Clock } from "../../../../shared/time/clock";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import type { JoinWindowPolicy } from "../../domain/session.policy";
import {
  checkWhiteboardScene,
  whiteboardAccess,
  type WhiteboardEditPolicy,
  type WhiteboardRole,
  type WhiteboardScene,
} from "../../domain/whiteboard.policy";
import { sessionsHeldByReport } from "./report-hold";
import { databaseNow } from "./session-tx";
import {
  appendEvidenceRead,
  requireOpenCaseForSession,
  requireStaffReviewer,
  STAFF_REVIEW_PERMISSION,
} from "./staff-evidence";

export const WHITEBOARD_READ_PERMISSION = "session:read:participant";
export const WHITEBOARD_UPDATE_PERMISSION =
  "session-whiteboard:update:participant";
export const WHITEBOARD_STAFF_PERMISSION = STAFF_REVIEW_PERMISSION;

const DAY_MS = 86_400_000;

type Reader = Pick<
  TransactionContext,
  "session" | "sessionWhiteboard" | "reportCase"
>;

const sessionSelect = {
  teacherId: true,
  learnerId: true,
  status: true,
  startAt: true,
  endAt: true,
} as const;

type WhiteboardPolicies = {
  join: JoinWindowPolicy;
  edit: WhiteboardEditPolicy;
};

function roleOf(
  actor: Principal,
  session: { teacherId: string },
): WhiteboardRole {
  return actor.userId === session.teacherId ? "TEACHER" : "LEARNER";
}

function revisionConflict(currentRevision: number) {
  return new ConflictException({
    message: "WHITEBOARD_REVISION_CONFLICT",
    currentRevision,
  });
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

@Injectable()
export class SessionWhiteboardService {
  constructor(
    private readonly db: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly configuration: SystemConfigurationService,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditWriter,
  ) {}

  async read(actor: Principal, sessionId: string) {
    if (!actor.permissions.includes(WHITEBOARD_READ_PERMISSION))
      throw new ForbiddenException("SESSION_ACCESS_DENIED");
    const session = await this.participantSession(this.db, actor, sessionId);
    const board = await this.db.sessionWhiteboard.findUnique({
      where: { sessionId },
      select: {
        revision: true,
        sceneData: true,
        updatedAt: true,
        updatedByUserId: true,
      },
    });
    const policies = await this.policies();
    const access = whiteboardAccess(
      session,
      roleOf(actor, session),
      this.clock.now(),
      policies?.join ?? null,
      policies?.edit ?? null,
      await this.underReport(this.db, sessionId),
    );
    return {
      revision: board?.revision ?? 0,
      sceneData: (board?.sceneData as WhiteboardScene | undefined) ?? null,
      updatedAt: board?.updatedAt ?? null,
      updatedByUserId: board?.updatedByUserId ?? null,
      ...access,
    };
  }

  async save(
    actor: Principal,
    sessionId: string,
    expectedRevision: number,
    sceneData: unknown,
  ) {
    if (!actor.permissions.includes(WHITEBOARD_UPDATE_PERMISSION))
      throw new ForbiddenException("SESSION_ACCESS_DENIED");
    const checked = checkWhiteboardScene(sceneData);
    if (!checked.ok) {
      if (checked.code === "WHITEBOARD_SCENE_TOO_LARGE")
        throw new PayloadTooLargeException(checked.code);
      throw new BadRequestException(checked.code);
    }
    try {
      return await this.transactions.run((tx) =>
        this.write(tx, actor, sessionId, expectedRevision, {
          scene: checked.scene,
          bytes: checked.bytes,
        }),
      );
    } catch (error) {
      // Two first saves raced on the unique sessionId; the loser must reload.
      if (!isUniqueViolation(error)) throw error;
      const current = await this.db.sessionWhiteboard.findUnique({
        where: { sessionId },
        select: { revision: true },
      });
      throw revisionConflict(current?.revision ?? 0);
    }
  }

  /**
   * Spec 019 P2: the Staff member handling an open report on this Session may
   * read, never edit, its board. Every read is audited in the same transaction.
   */
  async staffRead(actor: Principal, sessionId: string, caseId: string) {
    requireStaffReviewer(actor);
    return this.transactions.run(async (tx) => {
      await requireOpenCaseForSession(tx, actor, sessionId, caseId);
      const board = await tx.sessionWhiteboard.findUnique({
        where: { sessionId },
        select: {
          revision: true,
          sceneData: true,
          updatedAt: true,
          updatedByUserId: true,
        },
      });
      await appendEvidenceRead(this.audit, tx, actor, {
        targetType: "SESSION_WHITEBOARD",
        targetId: sessionId,
        caseId,
        reason: "Staff accessed the session whiteboard",
      });
      return {
        caseId,
        revision: board?.revision ?? 0,
        sceneData: (board?.sceneData as WhiteboardScene | undefined) ?? null,
        updatedAt: board?.updatedAt ?? null,
        updatedByUserId: board?.updatedByUserId ?? null,
      };
    });
  }

  /**
   * Spec 019 P3: delete one page of scenes whose Session ended more than
   * whiteboard.retentionDays ago, skipping Sessions with an open report.
   * Returns the last examined sessionId so held rows never stall the sweep.
   */
  async purgeExpired(
    limit: number,
    after?: string,
  ): Promise<{ deleted: number; next: string | null }> {
    return this.transactions.run(async (tx) => {
      const now = await databaseNow(tx);
      const { values } = await this.configuration.getSnapshot(
        ["whiteboard.retentionDays"],
        tx,
      );
      const cutoff = new Date(
        +now - values["whiteboard.retentionDays"] * DAY_MS,
      );
      const due = await tx.sessionWhiteboard.findMany({
        where: {
          session: { is: { endAt: { lte: cutoff } } },
          ...(after ? { sessionId: { gt: after } } : {}),
        },
        orderBy: { sessionId: "asc" },
        take: limit,
        select: { sessionId: true },
      });
      const ids = due.map(({ sessionId }) => sessionId);
      if (ids.length === 0) return { deleted: 0, next: null };
      const heldIds = await sessionsHeldByReport(tx, ids);
      const purge = ids.filter((id) => !heldIds.has(id));
      const { count } = purge.length
        ? await tx.sessionWhiteboard.deleteMany({
            where: { sessionId: { in: purge } },
          })
        : { count: 0 };
      return {
        deleted: count,
        next: ids.length < limit ? null : ids.at(-1)!,
      };
    });
  }

  private async write(
    tx: TransactionContext,
    actor: Principal,
    sessionId: string,
    expectedRevision: number,
    input: { scene: WhiteboardScene; bytes: number },
  ) {
    const session = await this.participantSession(tx, actor, sessionId);
    const now = await databaseNow(tx);
    const policies = await this.policies(tx);
    if (!policies)
      throw new ServiceUnavailableException("WHITEBOARD_POLICY_NOT_READY");
    const access = whiteboardAccess(
      session,
      roleOf(actor, session),
      now,
      policies.join,
      policies.edit,
      // Serializable: a report filed concurrently either freezes this save or retries it.
      await this.underReport(tx, sessionId),
    );
    if (access.readOnly)
      throw new ConflictException({
        message: "WHITEBOARD_READ_ONLY",
        reason: access.readOnlyReason,
      });
    const data = {
      sceneData: input.scene as Prisma.InputJsonValue,
      sceneBytes: input.bytes,
      updatedByUserId: actor.userId,
      updatedAt: now,
    };
    const current = await tx.sessionWhiteboard.findUnique({
      where: { sessionId },
      select: { revision: true },
    });
    if (!current) {
      if (expectedRevision !== 0) throw revisionConflict(0);
      const created = await tx.sessionWhiteboard.create({
        data: { sessionId, revision: 1, ...data },
        select: { revision: true, updatedAt: true },
      });
      return created;
    }
    // Conditional update: a concurrent save that committed first wins.
    const updated = await tx.sessionWhiteboard.updateMany({
      where: { sessionId, revision: expectedRevision },
      data: { ...data, revision: { increment: 1 } },
    });
    if (updated.count !== 1) throw revisionConflict(current.revision);
    return { revision: expectedRevision + 1, updatedAt: now };
  }

  private async participantSession(
    reader: Reader,
    actor: Principal,
    sessionId: string,
  ) {
    const session = await reader.session.findUnique({
      where: { id: sessionId },
      select: sessionSelect,
    });
    if (!session) throw new NotFoundException("SESSION_NOT_FOUND");
    if (
      actor.userId !== session.teacherId &&
      actor.userId !== session.learnerId
    )
      throw new ForbiddenException("SESSION_ACCESS_DENIED");
    return session;
  }

  /** An open report that targets or relates to the Session freezes its board. */
  private async underReport(reader: Reader, sessionId: string) {
    return (await sessionsHeldByReport(reader, [sessionId])).has(sessionId);
  }

  private async policies(
    tx?: TransactionContext,
  ): Promise<WhiteboardPolicies | null> {
    try {
      const { values } = await this.configuration.getSnapshot(
        ["livekit.joinWindow", "whiteboard.editWindow"],
        tx,
      );
      const join = values["livekit.joinWindow"];
      const edit = values["whiteboard.editWindow"];
      return join && edit ? { join, edit } : null;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) return null;
      throw error;
    }
  }
}
