import { randomUUID } from "node:crypto";
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { OutboxPublisherRegistry, type OutboxMessage } from "./outbox.types";

type ClaimedEvent = {
  event_id: string;
  type: string;
  version: number;
  payload: OutboxMessage["payload"];
  correlation_id: string;
  lease_token: string;
  cycle_attempts: number;
};

const publishTimeoutMs = 10_000;
const maxCycleAttempts = 8;

function failureCode(error: unknown): string {
  if (error instanceof Error && error.message === "PUBLISH_TIMEOUT")
    return "PUBLISH_TIMEOUT";
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string" && /^[A-Z0-9_]{1,64}$/.test(code)) return code;
  }
  return "PUBLISH_FAILED";
}

async function withTimeout<T>(
  work: Promise<T>,
  milliseconds: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("PUBLISH_TIMEOUT")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private timer?: NodeJS.Timeout;
  private active?: Promise<number>;
  private stopping = false;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: Pick<
      PrismaService,
      "$queryRaw" | "$executeRaw" | "outboxEvent"
    >,
    private readonly publishers: OutboxPublisherRegistry,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      if (!this.publishers.hasPublishers || this.stopping) return;
      void this.dispatchBatch().catch(() =>
        this.logger.error("Outbox dispatch failed"),
      );
    }, 1000);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    if (this.active)
      await withTimeout(
        this.active.catch(() => 0),
        publishTimeoutMs,
      ).catch(() => 0);
  }

  async dispatchBatch(): Promise<number> {
    if (this.stopping || !this.publishers.hasPublishers) return 0;
    if (this.active) return this.active;
    const operation = this.dispatchClaimedBatch();
    this.active = operation;
    try {
      return await operation;
    } finally {
      this.active = undefined;
    }
  }

  private async dispatchClaimedBatch(): Promise<number> {
    const token = randomUUID();
    const claimed = await this.prisma.$queryRaw<ClaimedEvent[]>`
      WITH picked AS (
        SELECT "event_id" FROM "outbox_events"
        WHERE "delivered_at" IS NULL AND "failed_at" IS NULL
          AND "available_at" <= CURRENT_TIMESTAMP
          AND ("lease_until" IS NULL OR "lease_until" < CURRENT_TIMESTAMP)
        ORDER BY "available_at", "created_at"
        FOR UPDATE SKIP LOCKED LIMIT 20
      )
      UPDATE "outbox_events" AS e
      SET "lease_token" = ${token}::uuid,
          "lease_until" = CURRENT_TIMESTAMP + INTERVAL '30 seconds',
          "total_attempts" = e."total_attempts" + 1,
          "cycle_attempts" = e."cycle_attempts" + 1
      FROM picked WHERE e."event_id" = picked."event_id"
      RETURNING e."event_id", e."type", e."version", e."payload",
        e."correlation_id", e."lease_token", e."cycle_attempts"
    `;
    let delivered = 0;
    for (const row of claimed) {
      const publisher = this.publishers.get(row.type);
      if (!publisher) {
        await this.fail(row, "UNKNOWN_EVENT_TYPE", true);
        continue;
      }
      const event: OutboxMessage = {
        eventId: row.event_id,
        type: row.type,
        version: row.version,
        payload: row.payload,
        correlationId: row.correlation_id,
      };
      try {
        await withTimeout(publisher.publish(event), publishTimeoutMs);
        const changed = await this.prisma.$executeRaw`
          UPDATE "outbox_events"
          SET "delivered_at" = CURRENT_TIMESTAMP,
              "lease_token" = NULL, "lease_until" = NULL
          WHERE "event_id" = ${row.event_id}::uuid AND "lease_token" = ${row.lease_token}::uuid
        `;
        delivered += changed;
      } catch (error) {
        await this.fail(row, failureCode(error), false);
      }
    }
    return delivered;
  }

  private async fail(
    row: ClaimedEvent,
    code: string,
    permanent: boolean,
  ): Promise<void> {
    const exhausted = permanent || row.cycle_attempts >= maxCycleAttempts;
    const retryMs =
      Math.min(60_000, 1000 * 2 ** Math.max(0, row.cycle_attempts - 1)) +
      Math.floor(Math.random() * 1000);
    await this.prisma.$executeRaw`
      UPDATE "outbox_events"
      SET "lease_token" = NULL, "lease_until" = NULL,
          "failed_at" = CASE WHEN ${exhausted} THEN CURRENT_TIMESTAMP ELSE NULL END,
          "available_at" = CASE WHEN ${exhausted} THEN "available_at" ELSE CURRENT_TIMESTAMP + (${retryMs} * INTERVAL '1 millisecond') END,
          "last_error_code" = ${code}
      WHERE "event_id" = ${row.event_id}::uuid AND "lease_token" = ${row.lease_token}::uuid
    `;
  }

  async retryFailed(eventId: string): Promise<void> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: { eventId, failedAt: { not: null }, deliveredAt: null },
      data: {
        failedAt: null,
        leaseToken: null,
        leaseUntil: null,
        availableAt: new Date(),
        cycleAttempts: 0,
        replayCount: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new Error("Failed outbox event not found");
  }
}
