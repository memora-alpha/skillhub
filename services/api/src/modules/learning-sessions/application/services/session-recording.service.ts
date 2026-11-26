import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from "../../../../infrastructure/storage/object-storage.port";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { CLOCK, type Clock } from "../../../../shared/time/clock";
import type { Principal } from "../../../auth/application/services/sessions.service";
import { AuditWriter } from "../../../audit/application/services/audit-writer";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import {
  ACTIVE_RECORDING_STATUSES,
  recordingExpiresAt,
  recordingObjectKey,
  recordingRequestCheck,
  recordingRequestExpired,
  RECORDING_REQUEST_TTL_MS,
  responderError,
  type RecordingKind,
  type RecordingStatus,
} from "../../domain/recording.policy";
import type { SessionTiming } from "../../domain/session.policy";
import {
  LiveKitEgressService,
  RecordingProviderError,
} from "../../infrastructure/livekit/livekit-egress.service";
import { sessionsHeldByReport } from "./report-hold";
import { failRecording } from "./session-recording-events.service";
import { emitSessionEvent } from "./session-transitions";
import { databaseNow } from "./session-tx";
import {
  appendEvidenceRead,
  requireOpenCaseForSession,
  requireStaffReviewer,
} from "./staff-evidence";

export const RECORDING_PERMISSION = "session-recording:manage:participant";
export const RECORDING_REQUESTED_EVENT = "session.recording.requested";
export const RECORDING_DELETED_EVENT = "session.recording.deleted";
/** Presigned playback URLs live this long (spec D5); the storage adapter caps it at 300. */
export const RECORDING_PLAYBACK_TTL_SECONDS = 300;

const TERMINAL_OR_STOPPING = new Set<RecordingStatus>([
  "STOPPING",
  "READY",
  "FAILED",
  "DECLINED",
  "REQUEST_EXPIRED",
  "EXPIRED",
  "DELETED",
]);

const sessionSelect = {
  id: true,
  teacherId: true,
  learnerId: true,
  status: true,
  startAt: true,
  endAt: true,
  roomName: true,
} as const;

const recordingSelect = {
  id: true,
  sessionId: true,
  status: true,
  kind: true,
  requestedByUserId: true,
  acceptedByUserId: true,
  egressId: true,
  requestedAt: true,
  startedAt: true,
  endedAt: true,
  durationMs: true,
  bytes: true,
  stopReason: true,
  objectKey: true,
  deletedAt: true,
} as const;

type Reader = Pick<TransactionContext, "session" | "sessionRecording">;
type SessionRow = SessionTiming & {
  id: string;
  teacherId: string;
  learnerId: string;
  roomName: string | null;
};
type RecordingRow = {
  id: string;
  sessionId: string;
  status: RecordingStatus;
  kind: RecordingKind;
  requestedByUserId: string;
  acceptedByUserId: string | null;
  egressId: string | null;
  requestedAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMs: bigint | null;
  bytes: bigint | null;
  stopReason: string | null;
  objectKey: string | null;
  deletedAt: Date | null;
};

type RecordingSettings = {
  kind: RecordingKind;
  joinWindow: { earlyMinutes: number; lateMinutes: number };
};

function stateConflict(status: RecordingStatus) {
  return new ConflictException({
    message: "RECORDING_STATE_CONFLICT",
    status,
  });
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

const toNumber = (value: bigint | null) =>
  value === null ? null : Number(value);

/**
 * Spec 020 consent flow: a participant asks, the other accepts, either stops.
 * Egress calls happen after the commit that moves a row to STARTING or STOPPING;
 * the reconcile worker repairs a row whose call failed or whose webhook was lost.
 */
@Injectable()
export class SessionRecordingService {
  private readonly logger = new Logger(SessionRecordingService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly configuration: SystemConfigurationService,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly egress: LiveKitEgressService,
    @Inject(OBJECT_STORAGE) private readonly objects: ObjectStorage,
    private readonly audit: AuditWriter,
  ) {}

  async request(actor: Principal, sessionId: string) {
    this.requirePermission(actor);
    try {
      const row = await this.transactions.run(async (tx) => {
        const session = await this.participantSession(tx, actor, sessionId);
        const settings = await this.enabledSettings(tx);
        const now = await databaseNow(tx);
        this.requireRequestWindow(session, now, settings);
        await this.expireStaleRequests(tx, sessionId, now);
        const active = await tx.sessionRecording.findFirst({
          where: { sessionId, status: { in: [...ACTIVE_RECORDING_STATUSES] } },
          select: { id: true },
        });
        if (active) throw new ConflictException("RECORDING_ALREADY_ACTIVE");
        const created = await tx.sessionRecording.create({
          data: {
            id: randomUUID(),
            sessionId,
            requestedByUserId: actor.userId,
            kind: settings.kind,
            status: "REQUESTED",
            requestedAt: now,
          },
          select: recordingSelect,
        });
        await emitSessionEvent(
          tx,
          RECORDING_REQUESTED_EVENT,
          sessionId,
          `recording-requested:${created.id}`,
          { recordingId: created.id, requestedByUserId: actor.userId },
        );
        return created;
      });
      return this.view(row as RecordingRow, null, false);
    } catch (error) {
      // The partial unique index caught a request that raced past the check.
      if (isUniqueViolation(error))
        throw new ConflictException("RECORDING_ALREADY_ACTIVE");
      throw error;
    }
  }

  async accept(actor: Principal, sessionId: string, recordingId: string) {
    this.requirePermission(actor);
    const { session, row } = await this.transactions.run(async (tx) => {
      const { session, row } = await this.answerable(
        tx,
        actor,
        sessionId,
        recordingId,
      );
      const settings = await this.enabledSettings(tx);
      const now = await databaseNow(tx);
      this.requireRequestWindow(session, now, settings);
      const moved = await tx.sessionRecording.updateMany({
        where: { id: recordingId, status: "REQUESTED" },
        data: { status: "STARTING", acceptedByUserId: actor.userId },
      });
      if (moved.count !== 1) throw stateConflict(row.status);
      return {
        session,
        row: {
          ...row,
          status: "STARTING" as const,
          acceptedByUserId: actor.userId,
        },
      };
    });
    return this.view(await this.startEgress(session, row), null, false);
  }

  async decline(actor: Principal, sessionId: string, recordingId: string) {
    this.requirePermission(actor);
    const row = await this.transactions.run(async (tx) => {
      const { row } = await this.answerable(tx, actor, sessionId, recordingId);
      const moved = await tx.sessionRecording.updateMany({
        where: { id: recordingId, status: "REQUESTED" },
        data: { status: "DECLINED" },
      });
      if (moved.count !== 1) throw stateConflict(row.status);
      return { ...row, status: "DECLINED" as const };
    });
    return this.view(row, null, false);
  }

  /** Either participant; idempotent once the row is stopping or finished. */
  async stop(actor: Principal, sessionId: string, recordingId: string) {
    this.requirePermission(actor);
    const row = await this.transactions.run(async (tx) => {
      await this.participantSession(tx, actor, sessionId);
      const row = await this.recording(tx, sessionId, recordingId);
      if (TERMINAL_OR_STOPPING.has(row.status)) return { row, moved: false };
      if (row.status === "REQUESTED") throw stateConflict(row.status);
      const moved = await tx.sessionRecording.updateMany({
        where: { id: recordingId, status: row.status },
        data: {
          status: "STOPPING",
          stoppedByUserId: actor.userId,
          stopReason: "PARTICIPANT",
        },
      });
      if (moved.count !== 1) {
        const current = await this.recording(tx, sessionId, recordingId);
        return { row: current, moved: false };
      }
      return {
        row: await this.recording(tx, sessionId, recordingId),
        moved: true,
      };
    });
    // Without an egress id yet, startEgress stops the Egress once it has one. If both sides
    // miss each other, the reconcile worker stops an Egress whose row is STOPPING.
    if (row.moved && row.row.egressId) await this.stopEgress(row.row.egressId);
    return this.view(row.row, null, false);
  }

  async list(actor: Principal, sessionId: string) {
    this.requirePermission(actor);
    const session = await this.participantSession(this.db, actor, sessionId);
    const now = this.clock.now();
    const rows = (await this.db.sessionRecording.findMany({
      where: { sessionId },
      orderBy: { requestedAt: "desc" },
      select: recordingSelect,
    })) as RecordingRow[];
    const retentionDays = await this.retentionDays();
    const held = (await sessionsHeldByReport(this.db, [sessionId])).has(
      sessionId,
    );
    return {
      items: rows.map((row) => {
        // An unanswered request past its TTL reads as expired before the worker marks it.
        const status =
          row.status === "REQUESTED" &&
          recordingRequestExpired(row.requestedAt, now)
            ? "REQUEST_EXPIRED"
            : row.status;
        const expiresAt =
          status === "READY" && retentionDays !== null
            ? recordingExpiresAt(session.endAt, retentionDays)
            : null;
        return this.view({ ...row, status }, expiresAt, held);
      }),
    };
  }

  /**
   * Spec D5: a short-lived inline URL for a READY recording, until it expires. An open
   * report keeps it watchable past expiry, because the sweep will not remove it.
   */
  async playback(actor: Principal, sessionId: string, recordingId: string) {
    this.requirePermission(actor);
    const session = await this.participantSession(this.db, actor, sessionId);
    const row = await this.recording(this.db, sessionId, recordingId);
    if (row.status !== "READY" || !row.objectKey)
      throw new ConflictException("RECORDING_NOT_READY");
    const now = this.clock.now();
    const retentionDays = await this.retentionDays();
    const expired =
      retentionDays === null ||
      now >= recordingExpiresAt(session.endAt, retentionDays);
    if (
      expired &&
      !(await sessionsHeldByReport(this.db, [sessionId])).has(sessionId)
    )
      throw new ConflictException("RECORDING_NOT_READY");
    return this.signPlayback(row.kind, row.objectKey, now);
  }

  /**
   * Spec D10: the handler of an open report on this Session watches a READY recording
   * through the same short-lived URL. Each URL issued is audited in the same transaction;
   * a refused or failed request writes nothing. An open case holds the recording, so expiry
   * does not apply.
   */
  async staffReview(
    actor: Principal,
    sessionId: string,
    recordingId: string,
    caseId: string,
  ) {
    requireStaffReviewer(actor);
    return this.transactions.run(async (tx) => {
      await requireOpenCaseForSession(tx, actor, sessionId, caseId);
      const row = await this.recording(tx, sessionId, recordingId);
      if (row.status !== "READY" || !row.objectKey)
        throw new ConflictException("RECORDING_NOT_READY");
      const playback = await this.signPlayback(
        row.kind,
        row.objectKey,
        await databaseNow(tx),
      );
      await appendEvidenceRead(this.audit, tx, actor, {
        targetType: "SESSION_RECORDING",
        targetId: recordingId,
        caseId,
        reason: "Staff accessed the session recording",
      });
      return { caseId, ...playback };
    });
  }

  private async signPlayback(
    kind: RecordingKind,
    objectKey: string,
    now: Date,
  ) {
    const mime = kind === "AUDIO_ONLY" ? "audio/mp4" : "video/mp4";
    let url: string;
    try {
      url = await this.objects.signGet(objectKey, {
        expiresInSeconds: RECORDING_PLAYBACK_TTL_SECONDS,
        disposition: "inline",
        mime,
      });
    } catch {
      throw new ServiceUnavailableException("RECORDING_UNAVAILABLE");
    }
    return {
      url,
      expiresAt: new Date(+now + RECORDING_PLAYBACK_TTL_SECONDS * 1000),
      mime,
    };
  }

  /**
   * Spec D7: either participant deletes a READY recording for both, unless an open report
   * holds it. The row is marked first so playback stops at once; the object is removed
   * after the commit, and the retention sweep retries a removal that failed.
   */
  async remove(actor: Principal, sessionId: string, recordingId: string) {
    this.requirePermission(actor);
    const row = await this.transactions.run(async (tx) => {
      await this.participantSession(tx, actor, sessionId);
      const row = await this.recording(tx, sessionId, recordingId);
      if (row.status === "DELETED") return row;
      if (row.status !== "READY") throw stateConflict(row.status);
      if ((await sessionsHeldByReport(tx, [sessionId])).has(sessionId))
        throw new ConflictException("RECORDING_HELD_BY_REPORT");
      const now = await databaseNow(tx);
      const moved = await tx.sessionRecording.updateMany({
        where: { id: recordingId, status: "READY" },
        data: {
          status: "DELETED",
          deletedAt: now,
          deletedByUserId: actor.userId,
        },
      });
      if (moved.count !== 1) {
        const current = await this.recording(tx, sessionId, recordingId);
        if (current.status === "DELETED") return current;
        throw stateConflict(current.status);
      }
      await emitSessionEvent(
        tx,
        RECORDING_DELETED_EVENT,
        sessionId,
        `recording-deleted:${recordingId}`,
        { recordingId, deletedByUserId: actor.userId },
      );
      return this.recording(tx, sessionId, recordingId);
    });
    if (row.objectKey) await removeRecordingObject(this.db, this.objects, row);
    return this.view(
      (await this.recording(this.db, sessionId, recordingId)) as RecordingRow,
      null,
      false,
    );
  }

  private async startEgress(session: SessionRow, row: RecordingRow) {
    let egressId: string;
    try {
      ({ egressId } = await this.egress.start({
        roomName: session.roomName!,
        objectKey: recordingObjectKey(session.id, row.id),
        kind: row.kind,
      }));
    } catch (error) {
      if (!(error instanceof RecordingProviderError)) throw error;
      return this.fail(row, error.code);
    }
    const saved = await this.db.sessionRecording.updateMany({
      where: { id: row.id, egressId: null },
      data: { egressId },
    });
    const current = (await this.db.sessionRecording.findUniqueOrThrow({
      where: { id: row.id },
      select: recordingSelect,
    })) as RecordingRow;
    // A participant stopped it while Egress was starting: stop the Egress now.
    if (saved.count === 1 && current.status === "STOPPING")
      await this.stopEgress(egressId);
    return current;
  }

  private async fail(row: RecordingRow, failureCode: string) {
    await this.transactions.run(async (tx) => {
      // The row may have moved to STOPPING while Egress was starting.
      const current = await this.recording(tx, row.sessionId, row.id);
      await failRecording(tx, current, failureCode, await databaseNow(tx));
    });
    return (await this.db.sessionRecording.findUniqueOrThrow({
      where: { id: row.id },
      select: recordingSelect,
    })) as RecordingRow;
  }

  private async stopEgress(egressId: string) {
    try {
      await this.egress.stop(egressId);
    } catch (error) {
      if (!(error instanceof RecordingProviderError)) throw error;
      // The reconcile worker retries; the row is already STOPPING.
      this.logger.warn(`Egress stop deferred to reconcile: ${error.code}`);
    }
  }

  /** The row must be REQUESTED, unexpired, and answered by the other participant. */
  private async answerable(
    tx: TransactionContext,
    actor: Principal,
    sessionId: string,
    recordingId: string,
  ) {
    const session = await this.participantSession(tx, actor, sessionId);
    const row = await this.recording(tx, sessionId, recordingId);
    const error = responderError(session, row, actor.userId);
    if (error) throw new ForbiddenException(error);
    if (row.status !== "REQUESTED") throw stateConflict(row.status);
    // Reported as expired here; request(), list and the worker persist the status.
    if (recordingRequestExpired(row.requestedAt, await databaseNow(tx)))
      throw stateConflict("REQUEST_EXPIRED");
    return { session, row };
  }

  private async expireStaleRequests(
    tx: TransactionContext,
    sessionId: string,
    now: Date,
  ) {
    await tx.sessionRecording.updateMany({
      where: {
        sessionId,
        status: "REQUESTED",
        requestedAt: { lte: new Date(+now - RECORDING_REQUEST_TTL_MS) },
      },
      data: { status: "REQUEST_EXPIRED" },
    });
  }

  private requireRequestWindow(
    session: SessionRow,
    now: Date,
    settings: RecordingSettings,
  ) {
    const check = recordingRequestCheck(session, now, settings.joinWindow);
    if (!check.allowed) {
      if (check.reason === "RECORDING_POLICY_NOT_READY")
        throw new ServiceUnavailableException("RECORDING_UNAVAILABLE");
      throw new ConflictException(check.reason);
    }
    // Egress records a LiveKit room, which exists once a participant joined.
    if (!session.roomName)
      throw new ConflictException("RECORDING_ROOM_NOT_STARTED");
  }

  private requirePermission(actor: Principal) {
    if (!actor.permissions.includes(RECORDING_PERMISSION))
      throw new ForbiddenException("SESSION_ACCESS_DENIED");
  }

  private async participantSession(
    reader: Reader | PrismaService,
    actor: Principal,
    sessionId: string,
  ): Promise<SessionRow> {
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

  private async recording(
    reader: Reader,
    sessionId: string,
    recordingId: string,
  ): Promise<RecordingRow> {
    const row = await reader.sessionRecording.findFirst({
      where: { id: recordingId, sessionId },
      select: recordingSelect,
    });
    if (!row) throw new NotFoundException("RECORDING_NOT_FOUND");
    return row as RecordingRow;
  }

  /** 503 when recording is off, unconfigured, or its policy is missing. */
  private async enabledSettings(
    tx: TransactionContext,
  ): Promise<RecordingSettings> {
    let values;
    try {
      ({ values } = await this.configuration.getSnapshot(
        ["recording.enabled", "recording.kind", "livekit.joinWindow"],
        tx,
      ));
    } catch (error) {
      if (error instanceof ServiceUnavailableException)
        throw new ServiceUnavailableException("RECORDING_UNAVAILABLE");
      throw error;
    }
    if (!values["recording.enabled"])
      throw new ServiceUnavailableException("RECORDING_DISABLED");
    if (!this.egress.available)
      throw new ServiceUnavailableException("RECORDING_UNAVAILABLE");
    return {
      kind: values["recording.kind"],
      joinWindow: values["livekit.joinWindow"],
    };
  }

  private async retentionDays(): Promise<number | null> {
    try {
      const { values } = await this.configuration.getSnapshot([
        "recording.retentionDays",
      ]);
      return values["recording.retentionDays"];
    } catch (error) {
      if (error instanceof ServiceUnavailableException) return null;
      throw error;
    }
  }

  private view(row: RecordingRow, expiresAt: Date | null, held: boolean) {
    return {
      id: row.id,
      sessionId: row.sessionId,
      status: row.status,
      kind: row.kind,
      requestedByUserId: row.requestedByUserId,
      acceptedByUserId: row.acceptedByUserId,
      requestedAt: row.requestedAt,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationMs: toNumber(row.durationMs),
      bytes: toNumber(row.bytes),
      stopReason: row.stopReason,
      expiresAt,
      heldByReport: held,
      deletedAt: row.deletedAt,
    };
  }
}

/**
 * Removes the object of a DELETED or EXPIRED recording and clears its key, so a failed
 * removal is retried by the retention sweep. S3 treats a missing key as removed.
 */
export async function removeRecordingObject(
  db: Pick<PrismaService, "sessionRecording">,
  objects: ObjectStorage,
  row: { id: string; objectKey: string | null },
): Promise<boolean> {
  if (!row.objectKey) return true;
  try {
    await objects.remove(row.objectKey);
  } catch {
    return false;
  }
  await db.sessionRecording.updateMany({
    where: {
      id: row.id,
      objectKey: row.objectKey,
      status: { in: ["DELETED", "EXPIRED"] },
    },
    data: { objectKey: null },
  });
  return true;
}
