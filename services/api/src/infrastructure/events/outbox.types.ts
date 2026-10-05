import { Injectable } from "@nestjs/common";
import type { JsonValue } from "../idempotency/idempotency.types";

export type OutboxMessage = {
  eventId: string;
  type: string;
  version: number;
  payload: JsonValue;
  correlationId: string;
};

export interface OutboxPublisher {
  publish(event: OutboxMessage): Promise<void>;
}

@Injectable()
export class OutboxPublisherRegistry {
  private readonly publishers = new Map<string, OutboxPublisher>();

  register(type: string, publisher: OutboxPublisher): void {
    if (!/^[a-z][a-z0-9.:-]{0,127}$/.test(type) || this.publishers.has(type)) {
      throw new Error("Invalid or duplicate outbox event type");
    }
    this.publishers.set(type, publisher);
  }

  get(type: string): OutboxPublisher | undefined {
    return this.publishers.get(type);
  }

  get hasPublishers(): boolean {
    return this.publishers.size > 0;
  }
}
