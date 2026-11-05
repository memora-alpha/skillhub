import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { CLOCK, type Clock } from "../../../../shared/time/clock";
import { LiveKitService } from "../livekit/livekit.service";
import { LearningSessionsService } from "../../application/services/learning-sessions.service";

import {
  SessionOutcomeService,
  type ObservationResult,
} from "../../application/services/session-outcome.service";
import { byCodeUnit } from "../../../../infrastructure/idempotency/idempotency.service";
import { settlementRetryDelay } from "../../../learning-paths/application/services/path-settlement-state";

@Injectable()
export class SessionLifecycleWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private stopped = false;
  private readonly logger = new Logger(SessionLifecycleWorker.name);
  constructor(
    private readonly db: PrismaService,
    private readonly sessions: LearningSessionsService,
    private readonly livekit: LiveKitService,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly outcomes: SessionOutcomeService,
  ) {}

  onModuleInit() {
    const run = () => {
      void this.sweep(this.clock.now(), 100).catch(() =>
        this.logger.error("SESSION_RECOVERY_UNAVAILABLE"),
      );
    };
    this.timer = setInterval(run, 30_000);
    this.timer.unref();
    run();
  }
  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(now: Date, limit: number) {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      await this.advanceActiveSessions(now, limit);
      await this.determineEndedSessions(now, limit);
      await this.finalizeDueSessions(now, limit);
      await this.settleCompletedPaths(limit);
    } finally {
      this.running = false;
    }
  }

  private async advanceActiveSessions(now: Date, limit: number) {
    let cursor: string | undefined;
    // ponytail: seek through active rows every sweep; add a due-time index when volume warrants it.
    while (!this.stopped) {
      const rows = await this.db.session.findMany({
        where: {
          status: { in: ["CONFIRMED", "READY", "ONGOING"] },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: "asc" },
        take: limit,
        select: {
          id: true,
          startAt: true,
          endAt: true,
          roomName: true,
          providerRoomId: true,
        },
      });
      for (const row of rows) {
        if (this.stopped) break;
        const result = await this.observeLiveRoom(row, now);
        if (result)
          await this.outcomes
            .recordObservation(row, result, now)
            .catch(() => this.logger.error("SESSION_ATTENDANCE_DEFERRED"));
        await this.sessions
          .advanceLifecycle(
            row,
            result?.status === "OK" ? result.observation : null,
          )
          .catch(() => this.logger.error("SESSION_LIFECYCLE_DEFERRED"));
      }
      if (rows.length < limit) break;
      cursor = rows.at(-1)!.id;
    }
  }

  private async observeLiveRoom(
    row: { roomName: string | null; startAt: Date; endAt: Date },
    now: Date,
  ): Promise<ObservationResult | null> {
    if (
      !row.roomName ||
      row.startAt > now ||
      row.endAt <= now ||
      !this.livekit.config.enabled
    )
      return null;
    try {
      return {
        status: "OK",
        observation: await this.livekit.listActiveParticipants(row.roomName),
      };
    } catch {
      this.logger.warn("LIVEKIT_OBSERVATION_UNAVAILABLE");
      return { status: "FAILED" };
    }
  }

  private async determineEndedSessions(now: Date, limit: number) {
    let cursor: string | undefined;
    while (!this.stopped) {
      const rows: { id: string }[] = await this.db.session.findMany({
        where: {
          status: {
            in: ["CONFIRMED", "READY", "ONGOING", "AWAITING_CONFIRMATION"],
          },
          endAt: { lte: now },
          confirmDeadlineAt: null,
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: "asc" },
        take: limit,
        select: { id: true },
      });
      for (const row of rows) {
        if (this.stopped) break;
        await this.sessions
          .ensureDetermined(row.id)
          .catch(() => this.logger.error("SESSION_ATTENDANCE_DEFERRED"));
      }
      if (rows.length < limit) break;
      cursor = rows.at(-1)!.id;
    }
  }

  // ponytail: three bounded queries per sweep; page them when due rows exceed `limit`.
  private async finalizeDueSessions(now: Date, limit: number) {
    const [timeouts, makeups, noShows] = await Promise.all([
      this.db.session.findMany({
        where: {
          status: "AWAITING_CONFIRMATION",
          confirmDeadlineAt: { lte: now },
        },
        take: limit,
        select: { id: true },
      }),
      this.db.session.findMany({
        where: { status: "MAKEUP_REQUIRED", makeupDeadlineAt: { lte: now } },
        take: limit,
        select: { id: true },
      }),
      this.db.sessionAttendanceOutcome.findMany({
        where: { status: "PROVISIONAL", finalizesAt: { lte: now } },
        take: limit,
        select: { sessionId: true },
      }),
    ]);
    const ids = [
      ...new Set([
        ...timeouts.map(({ id }) => id),
        ...makeups.map(({ id }) => id),
        ...noShows.map(({ sessionId }) => sessionId),
      ]),
    ].sort(byCodeUnit);
    for (const id of ids) {
      if (this.stopped) break;
      await this.outcomes
        .finalizeDue(id)
        .catch(() => this.logger.error("SESSION_FINALIZATION_DEFERRED"));
    }
  }

  // Settlement itself rechecks every financial/dispute condition under a path lock.
  private async settleCompletedPaths(limit: number) {
    let cursor: string | undefined;
    while (!this.stopped) {
      const paths: { id: string }[] = await this.db.learningPath.findMany({
        where: {
          status: "ACTIVE",
          settledAt: null,
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: "asc" },
        take: limit,
        select: { id: true },
      });
      for (const path of paths) {
        if (this.stopped) break;
        const attempt = await this.db.pathSettlementAttempt.findUnique({
          where: { pathId: path.id },
        });
        if (
          attempt &&
          +this.clock.now() < +attempt.checkedAt + settlementRetryDelay(attempt)
        )
          continue;
        await this.sessions
          .trySettleCompletedPath(path.id)
          .catch(() => this.logger.error("SESSION_SETTLEMENT_DEFERRED"));
      }
      if (paths.length < limit) break;
      cursor = paths.at(-1)!.id;
    }
  }
}
