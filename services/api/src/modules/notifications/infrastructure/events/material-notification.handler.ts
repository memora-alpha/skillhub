import { Injectable, OnModuleInit } from "@nestjs/common";
import { createHash } from "node:crypto";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../../../../infrastructure/events/outbox.types";
import { NotificationDispatcher } from "../../application/services/notification-dispatcher";

const moderated = new Map([
  [
    "approve",
    {
      title: "Material published",
      body: "Your learning material is now live.",
    },
  ],
  [
    "unhide",
    {
      title: "Material published",
      body: "Your learning material is now live.",
    },
  ],
  [
    "reject",
    {
      title: "Material rejected",
      body: "Your learning material was rejected. See the review reason.",
    },
  ],
  [
    "hide",
    {
      title: "Material hidden",
      body: "Your learning material was hidden by Staff.",
    },
  ],
]);

/** SH-115..119: owner hears every moderation decision; buyer and seller hear each sale. */
@Injectable()
export class MaterialNotificationHandler
  implements OnModuleInit, OutboxPublisher
{
  constructor(
    private readonly registry: OutboxPublisherRegistry,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  onModuleInit(): void {
    this.registry.register("material.moderated", this);
    this.registry.register("material.purchased", this);
  }

  async publish(event: OutboxMessage): Promise<void> {
    const data = event.payload;
    if (
      event.version < 1 ||
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      typeof data.materialId !== "string"
    )
      throw new Error("INVALID_MATERIAL_EVENT");
    const materialId = data.materialId;
    if (event.type === "material.moderated") {
      const message =
        typeof data.action === "string" ? moderated.get(data.action) : null;
      if (!message || typeof data.ownerId !== "string")
        throw new Error("INVALID_MATERIAL_EVENT");
      await this.dispatcher.dispatch({
        eventId: event.eventId,
        type: event.type,
        userIds: [data.ownerId],
        ...message,
        payload: { materialId },
      });
      return;
    }
    if (
      event.type !== "material.purchased" ||
      typeof data.orderId !== "string" ||
      typeof data.buyerId !== "string" ||
      typeof data.sellerId !== "string"
    )
      throw new Error("INVALID_MATERIAL_EVENT");
    const payload = { materialId, orderId: data.orderId };
    await this.dispatcher.dispatch({
      eventId: event.eventId,
      type: event.type,
      userIds: [data.buyerId],
      title: "Material purchased",
      body: "Your purchased material is ready to download.",
      payload,
    });
    // One message carries one title, so the seller gets a second delivery with its own id.
    await this.dispatcher.dispatch({
      eventId: sellerEventId(event.eventId),
      type: event.type,
      userIds: [data.sellerId],
      title: "Material sold",
      body: "A buyer purchased your learning material.",
      payload,
    });
  }
}

/**
 * Deterministic UUIDv8 per event, so a redelivered sale is deduplicated by the
 * dispatcher's receipts and the seller's inbox id stays a valid UUID.
 */
function sellerEventId(eventId: string): string {
  const hex = createHash("sha256")
    .update(`material.purchased.seller:${eventId}`)
    .digest("hex");
  // Version nibble 8, RFC 4122 variant bits 10.
  const variant = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
