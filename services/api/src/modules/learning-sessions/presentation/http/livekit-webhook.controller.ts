import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { ApiExcludeController } from "@nestjs/swagger";
import { createHash } from "node:crypto";
import { OutboxConsumer } from "../../../../infrastructure/events/outbox-consumer";
import { LiveKitService } from "../../infrastructure/livekit/livekit.service";
import { LearningSessionsService } from "../../application/services/learning-sessions.service";
import { SessionRecordingEventsService } from "../../application/services/session-recording-events.service";
import { egressSnapshot } from "../../infrastructure/livekit/livekit-egress.service";

const EGRESS_EVENTS = new Set([
  "egress_started",
  "egress_updated",
  "egress_ended",
]);

function receiptId(eventId: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(eventId))
    throw new BadRequestException("INVALID_LIVEKIT_WEBHOOK_EVENT");
  if (/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(eventId))
    return eventId.toLowerCase();
  // Cloud IDs are opaque (EV_...). Map to UUIDv8 without changing the receipt schema.
  const hash = createHash("sha256")
    .update(`livekit.session-lifecycle\0${eventId}`)
    .digest();
  hash[6] = (hash[6]! & 0x0f) | 0x80;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

@ApiExcludeController()
@Controller({ path: "livekit", version: "1" })
export class LiveKitWebhookController {
  constructor(
    private readonly livekit: LiveKitService,
    private readonly consumer: OutboxConsumer,
    private readonly sessions: LearningSessionsService,
    private readonly recordings: SessionRecordingEventsService,
  ) {}

  @Post("webhook")
  @HttpCode(204)
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers("authorization") authorization = "",
  ) {
    if (!request.rawBody)
      throw new BadRequestException("INVALID_LIVEKIT_WEBHOOK_BODY");
    const event = await this.livekit.verifyWebhook(
      request.rawBody.toString("utf8"),
      authorization,
    );
    const deliveryId = receiptId(event.id);
    if (EGRESS_EVENTS.has(event.event)) {
      // Spec 020: recording events have their own receipt consumer and never touch attendance.
      if (!event.egressInfo?.egressId) return;
      const info = egressSnapshot(event.egressInfo);
      const result = await this.consumer.processOnce(
        "livekit.session-recording",
        deliveryId,
        (tx) => this.recordings.applyEgress(tx, info),
      );
      if (result.processed)
        await this.recordings.syncIndicator(result.value ?? null);
      return;
    }
    await this.sessions.reconcileLiveKitRoom(event);
    await this.consumer.processOnce(
      "livekit.session-lifecycle",
      deliveryId,
      (tx) => this.sessions.applyLiveKitActivity(tx, event),
    );
  }
}
