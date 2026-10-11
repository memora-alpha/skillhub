import {
  BadRequestException,
  Controller,
  Get,
  OnModuleDestroy,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { EventConfig } from "../domain/event-config";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  IdentityGuard,
  type IdentityRequest,
} from "../../../shared/auth/identity.guard";
import { SessionsService } from "../../auth/application/services/sessions.service";
import { ApplicationEventsService } from "../application/application-events.service";
import { EventConnectionsService } from "../application/event-connections.service";
import { decodeCursor, encodeCursor } from "../domain/event-cursor";

@ApiTags("application-events")
@ApiBearerAuth()
@UseGuards(IdentityGuard)
@Controller({ path: "events", version: "1" })
export class EventsController implements OnModuleDestroy {
  private readonly active = new Set<() => void>();
  private readonly secret: string;
  constructor(
    private readonly events: ApplicationEventsService,
    private readonly sessions: SessionsService,
    private readonly leases: EventConnectionsService,
    private readonly config: EventConfig,
  ) {
    this.secret = config.values.secret;
  }
  onModuleDestroy() {
    for (const close of this.active) close();
  }
  @Get()
  @ApiProduces("text/event-stream")
  @ApiOperation({
    summary: "Authenticated live application events; replay with Last-Event-ID",
  })
  @ApiResponse({
    status: 200,
    description:
      "SSE stream; stream.ready/checkpoint/reset-required control events",
    content: { "text/event-stream": { schema: { type: "string" } } },
  })
  async stream(@Req() req: IdentityRequest, @Res() res: Response) {
    if (req.query.token || req.query.access_token)
      throw new BadRequestException("TOKEN_IN_URL_FORBIDDEN");
    const principal = req.principal!;
    const token = req.headers.authorization!.slice(7);
    const last = req.headers["last-event-id"];
    if (last !== undefined && typeof last !== "string")
      throw new BadRequestException("INVALID_EVENT_CURSOR");
    const lease = await this.leases.acquire(
      principal.userId,
      principal.sessionId,
      req.ip ?? "unknown",
    );
    let closed = false,
      timer: ReturnType<typeof setInterval> | undefined,
      running = false,
      again = false;
    let cursor = 0n,
      epoch = "";
    const finish = () => {
      if (closed) return;
      closed = true;
      this.active.delete(finish);
      if (timer) clearInterval(timer);
      unsubscribe();
      res.end();
      void lease.release();
    };
    const write = async (frame: string) => {
      if (closed) return;
      if (
        res.writableLength + Buffer.byteLength(frame) >
        this.config.values.bufferBytes
      ) {
        finish();
        return;
      }
      if (!res.write(frame))
        await new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(timeout);
            res.off("drain", done);
            res.off("close", done);
            resolve();
          };
          const timeout = setTimeout(() => {
            finish();
            done();
          }, this.config.values.drainTimeoutMs);
          res.once("drain", done);
          res.once("close", done);
        });
    };
    const id = () =>
      encodeCursor(
        { userId: principal.userId, epoch, sequence: cursor },
        this.secret,
      );
    const pump = async () => {
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        do {
          again = false;
          const live = await this.sessions.principal(token);
          await this.events.authorize(live);
          const rows = await this.events.batch(principal.userId, epoch, cursor);
          for (const row of rows) {
            if (closed) break;
            await this.sessions.principal(token);
            const visible = await this.events.visible(live, row);
            cursor = row.sequence;
            await write(
              visible
                ? `id: ${id()}\nevent: ${row.type}\ndata: ${JSON.stringify({ eventId: row.eventId, version: row.version, occurredAt: row.occurredAt, data: row.payload })}\n\n`
                : `id: ${id()}\nevent: stream.checkpoint\ndata: {}\n\n`,
            );
          }
          if (rows.length === 100) again = true;
        } while (again && !closed);
      } catch (error) {
        if (
          !closed &&
          error instanceof Error &&
          error.message === "EVENT_CURSOR_EXPIRED"
        )
          await write("event: stream.reset-required\ndata: {}\n\n");
        finish();
      } finally {
        running = false;
      }
    };
    // Subscribe before capturing head; wakeups before initialization are caught by the first pump.
    let ready = false;
    const unsubscribe = this.events.subscribe(principal.userId, () => {
      if (ready) void pump();
    });
    res.once("close", finish);
    this.active.add(finish);
    try {
      const head = await this.events.head(principal.userId);
      epoch = head.epoch;
      cursor = last
        ? decodeCursor(last, principal.userId, epoch, this.secret)
        : head.lastSequence;
      await this.events.batch(principal.userId, epoch, cursor); // cursor failures are JSON before streaming headers
      await this.sessions.principal(token);
      await this.events.authorize(principal);
      if (closed) return;
      res.status(200).set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "private, no-cache, no-store, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      });
      res.flushHeaders();
      await write(
        `retry: ${this.config.values.retryMs}\nid: ${id()}\nevent: stream.ready\ndata: {}\n\n`,
      );
      if (closed) return;
      ready = true;
      timer = setInterval(() => {
        void lease
          .renew()
          .then(() => pump())
          .then(() => write(": heartbeat\n\n"))
          .catch(finish);
      }, this.config.values.heartbeatMs);
      await pump();
    } catch (error) {
      unsubscribe();
      this.active.delete(finish);
      res.off("close", finish);
      await lease.release();
      if (!res.headersSent) throw error;
      finish();
    }
  }
}
