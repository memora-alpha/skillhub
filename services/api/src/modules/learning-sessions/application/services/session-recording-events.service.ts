import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { TransactionRunner } from "../../../../infrastructure/database/transaction-runner";
import type { TransactionContext } from "../../../../infrastructure/database/transaction-context";
import { SubscriptionEntitlementsReader } from "../../../subscriptions/application/services/subscription-entitlements.reader";
import { SystemConfigurationService } from "../../../system-configuration/application/services/system-configuration.service";
import {
  canTransition,
  recordingObjectKey,
  recordingStopDeadline,
  RECORDING_REQUEST_TTL_MS,
  type RecordingKind,
  type RecordingStatus,
  type RecordingStopReason,
} from "../../domain/recording.policy";
import type {
  JoinWindowPolicy,
  SessionTiming,
} from "../../domain/session.policy";
import {
  LiveKitEgressService,
  RecordingProviderError,
  type EgressSnapshot,
} from "../../infrastructure/livekit/livekit-egress.service";
import { emitSessionEvent } from "./session-transitions";
import { databaseNow } from "./session-tx";

export const RECORDING_FAILED_EVENT = "session.recording.failed";

/** STARTING or STOPPING rows older than this are checked against the provider. */
const STUCK_AFTER_MS = 2 * 60_000;
const BATCH = 100;

/** Room metadata to apply after the commit that changed a recording. */
export type IndicatorChange = {
  roomName: string;
  recording: { id: string; kind: RecordingKind } | null;
};

type Applied = { moved: boolean; indicator: IndicatorChange | null };
const unchanged: Applied = { moved: false, indicator: null };

type Row = {
  id: string;
  sessionId: string;
  status: RecordingStatus;
  kind: RecordingKind;
  egressId: string | null;
  startedAt: Date | null;
  stopReason: RecordingStopReason | null;
  subscriptionId: string | null;
  chargedMinutes: number | null;
  session: { roomName: string | null };
};

const rowSelect = {
  id: true,
  sessionId: true,
  status: true,
  kind: true,
  egressId: true,
  startedAt: true,
  stopReason: true,
  subscriptionId: true,
  chargedMinutes: true,
  session: { select: { roomName: true } },
} as const;

type StopSettings = {
  enabled: boolean;
  join: JoinWindowPolicy;
  overrun: number;
};

export type ReconcileSummary = {
  expiredRequests: number;
  stopped: number;
  repaired: number;
};

/** Marks a recording FAILED and tells both participants, in the caller's transaction. */
export async function failRecording(
  tx: TransactionContext,
  row: { id: string; sessionId: string; status: RecordingStatus },
  failureCode: string,
  endedAt: Date,
): Promise<boolean> {
  if (!canTransition(row.status, "FAILED")) return false;
  const moved = await tx.sessionRecording.updateMany({
    where: { id: row.id, status: row.status },
    data: { status: "FAILED", failureCode, endedAt },
  });
  if (moved.count !== 1) return false;
  await emitSessionEvent(
    tx,
    RECORDING_FAILED_EVENT,
    row.sessionId,
    `recording-failed:${row.id}`,
    { recordingId: row.id },
  );
  return true;
}

/**
 * Spec 020 provider events: egress webhooks and the reconcile worker move rows
 * through the same transitions, so a lost webhook is repaired from listEgress.
 */
@Injectable()
export class SessionRecordingEventsService {
  private readonly logger = new Logger(SessionRecordingEventsService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly transactions: TransactionRunner,
    private readonly configuration: SystemConfigurationService,
    private readonly egress: LiveKitEgressService,
    private readonly plans?: SubscriptionEntitlementsReader,
  ) {}

  /** Applies one Egress state inside the caller's transaction. Unknown Egress ids are ignored. */
  async applyEgress(
    tx: TransactionContext,
    snapshot: EgressSnapshot,
  ): Promise<IndicatorChange | null> {
    return (await this.apply(tx, snapshot)).indicator;
  }

  /** Best effort: the room indicator follows the row; a failure is logged, never thrown. */
  async syncIndicator(change: IndicatorChange | null) {
    if (!change) return;
    try {
      await this.egress.setIndicator(change.roomName, change.recording);
    } catch (error) {
      if (!(error instanceof RecordingProviderError)) throw error;
      this.logger.warn(`Recording indicator not updated: ${error.code}`);
    }
  }

  /** One reconcile pass; the worker runs it every minute. */
  async reconcile(): Promise<ReconcileSummary> {
    const expiredRequests = await this.expireRequests();
    const stopped = await this.enforceStops();
    const repaired = await this.repairStuck();
    return { expiredRequests, stopped, repaired };
  }

  private async apply(
    tx: TransactionContext,
    snapshot: EgressSnapshot,
  ): Promise<Applied> {
    const row = (await tx.sessionRecording.findUnique({
      where: { egressId: snapshot.egressId },
      select: rowSelect,
    })) as Row | null;
    if (!row) return unchanged;
    const now = await databaseNow(tx);
    if (snapshot.status === "ACTIVE")
      return this.started(tx, row, snapshot, now);
    if (snapshot.status === "COMPLETE" && snapshot.file)
      return this.finished(tx, row, snapshot, now);
    const code =
      snapshot.status === "COMPLETE" ? "EGRESS_NO_FILE" : "EGRESS_FAILED";
    return this.failed(tx, row, code, snapshot.endedAt ?? now);
  }

  private async started(
    tx: TransactionContext,
    row: Row,
    snapshot: EgressSnapshot,
    now: Date,
  ): Promise<Applied> {
    if (row.status !== "STARTING") return unchanged;
    const moved = await tx.sessionRecording.updateMany({
      where: { id: row.id, status: "STARTING" },
      data: { status: "RECORDING", startedAt: snapshot.startedAt ?? now },
    });
    if (moved.count !== 1) return unchanged;
    const roomName = row.session.roomName;
    return {
      moved: true,
      indicator: roomName
        ? { roomName, recording: { id: row.id, kind: row.kind } }
        : null,
    };
  }

  private async finished(
    tx: TransactionContext,
    row: Row,
    snapshot: EgressSnapshot,
    now: Date,
  ): Promise<Applied> {
    if (!canTransition(row.status, "READY")) return unchanged;
    const endedAt = snapshot.endedAt ?? now;
    const moved = await tx.sessionRecording.updateMany({
      where: { id: row.id, status: row.status },
      data: {
        status: "READY",
        objectKey: recordingObjectKey(row.sessionId, row.id),
        bytes: snapshot.file!.bytes,
        durationMs: snapshot.file!.durationMs,
        startedAt: row.startedAt ?? snapshot.startedAt ?? now,
        endedAt,
        // Ended without a participant or the worker stopping it: the room closed.
        stopReason: row.stopReason ?? "ROOM_FINISHED",
      },
    });
    if (moved.count !== 1) return unchanged;
    await this.chargeMinutes(tx, row, snapshot.file!.durationMs, endedAt);
    return this.cleared(row);
  }

  /**
   * Spec 021 D11: a finished recording charges its requester's pinned subscription once, in
   * the transaction that marks it READY. `charged_minutes` records what the plan paid; a
   * second delivery finds it set and charges nothing. A failed Egress is never charged.
   */
  private async chargeMinutes(
    tx: TransactionContext,
    row: Row,
    durationMs: bigint,
    endedAt: Date,
  ) {
    if (!this.plans || !row.subscriptionId || row.chargedMinutes !== null)
      return;
    const charge = await this.plans.chargeRecordingMinutes(
      tx,
      row.subscriptionId,
      durationMs,
      endedAt,
    );
    const saved = await tx.sessionRecording.updateMany({
      where: { id: row.id, chargedMinutes: null },
      data: { chargedMinutes: charge.charged },
    });
    // Another delivery charged it first; throwing rolls this charge back.
    if (saved.count !== 1)
      throw new ConflictException("RECORDING_ALREADY_CHARGED");
  }

  private async failed(
    tx: TransactionContext,
    row: Row,
    failureCode: string,
    endedAt: Date,
  ): Promise<Applied> {
    return (await failRecording(tx, row, failureCode, endedAt))
      ? this.cleared(row)
      : unchanged;
  }

  private cleared(row: Row): Applied {
    const roomName = row.session.roomName;
    return {
      moved: true,
      indicator: roomName ? { roomName, recording: null } : null,
    };
  }

  private async expireRequests() {
    const now = await this.transactions.run(databaseNow);
    const { count } = await this.db.sessionRecording.updateMany({
      where: {
        status: "REQUESTED",
        requestedAt: { lte: new Date(+now - RECORDING_REQUEST_TTL_MS) },
      },
      data: { status: "REQUEST_EXPIRED" },
    });
    return count;
  }

  /** Kill switch, window close and the per-recording cap (spec D3, D9). */
  private async enforceStops() {
    const settings = await this.stopSettings();
    if (!settings) return 0;
    const rows = await this.db.sessionRecording.findMany({
      where: { status: { in: ["STARTING", "RECORDING"] } },
      orderBy: { requestedAt: "asc" },
      take: BATCH,
      select: {
        id: true,
        status: true,
        startedAt: true,
        egressId: true,
        session: { select: { status: true, startAt: true, endAt: true } },
      },
    });
    const now = await this.transactions.run(databaseNow);
    let stopped = 0;
    for (const row of rows) {
      const reason = this.stopReason(row, settings, now);
      if (!reason) continue;
      // Sequential on purpose: each stop commits before its provider call.
      const moved = await this.db.sessionRecording.updateMany({
        where: { id: row.id, status: row.status },
        data: { status: "STOPPING", stopReason: reason },
      });
      if (moved.count !== 1) continue;
      stopped += 1;
      if (row.egressId) await this.stopQuietly(row.egressId);
    }
    return stopped;
  }

  private stopReason(
    row: { startedAt: Date | null; session: SessionTiming },
    settings: StopSettings,
    now: Date,
  ): RecordingStopReason | null {
    if (!settings.enabled) return "DISABLED";
    if (!row.startedAt) return null;
    const deadline = recordingStopDeadline(
      row.session,
      row.startedAt,
      settings.join,
      settings.overrun,
    );
    return deadline && now >= deadline.at ? deadline.reason : null;
  }

  /** Rows whose Egress call or webhook went missing, checked against listEgress. */
  private async repairStuck() {
    const now = await this.transactions.run(databaseNow);
    const rows = (await this.db.sessionRecording.findMany({
      where: {
        status: { in: ["STARTING", "STOPPING"] },
        updatedAt: { lte: new Date(+now - STUCK_AFTER_MS) },
      },
      orderBy: { updatedAt: "asc" },
      take: BATCH,
      select: rowSelect,
    })) as Row[];
    let repaired = 0;
    for (const row of rows) {
      // Sequential on purpose: one provider list per row, then one transaction.
      if (await this.repair(row)) repaired += 1;
    }
    return repaired;
  }

  private async repair(row: Row) {
    const roomName = row.session.roomName;
    if (!row.egressId || !roomName) {
      // The API stopped between the STARTING commit and the Egress call.
      return this.commit((tx) => this.failedNow(tx, row, "EGRESS_START_LOST"));
    }
    let listed: EgressSnapshot[];
    try {
      listed = await this.egress.list(roomName);
    } catch (error) {
      if (!(error instanceof RecordingProviderError)) throw error;
      return false;
    }
    const snapshot = listed.find((item) => item.egressId === row.egressId);
    if (snapshot?.status === "ACTIVE" && row.status === "STOPPING") {
      await this.stopQuietly(row.egressId);
      return true;
    }
    if (!snapshot)
      return this.commit((tx) => this.failedNow(tx, row, "EGRESS_LOST"));
    return this.commit((tx) => this.apply(tx, snapshot));
  }

  private async failedNow(tx: TransactionContext, row: Row, code: string) {
    return this.failed(tx, row, code, await databaseNow(tx));
  }

  private async commit(work: (tx: TransactionContext) => Promise<Applied>) {
    const applied = await this.transactions.run(work);
    await this.syncIndicator(applied.indicator);
    return applied.moved;
  }

  private async stopQuietly(egressId: string) {
    try {
      await this.egress.stop(egressId);
    } catch (error) {
      if (!(error instanceof RecordingProviderError)) throw error;
      this.logger.warn(`Egress stop retried next pass: ${error.code}`);
    }
  }

  private async stopSettings(): Promise<StopSettings | null> {
    try {
      const { values } = await this.configuration.getSnapshot([
        "recording.enabled",
        "recording.overrunMinutes",
        "livekit.joinWindow",
      ]);
      return {
        enabled: values["recording.enabled"],
        overrun: values["recording.overrunMinutes"],
        join: values["livekit.joinWindow"],
      };
    } catch (error) {
      // Without policy the worker cannot judge deadlines; repairs still run.
      if (error instanceof ServiceUnavailableException) return null;
      throw error;
    }
  }
}
