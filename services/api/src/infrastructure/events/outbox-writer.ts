import { BadRequestException, Injectable } from "@nestjs/common";
import type { TransactionContext } from "../database/transaction-context";
import type { OutboxMessage } from "./outbox.types";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateOutboxMessage(event: OutboxMessage): void {
  if (
    !uuidPattern.test(event.eventId) ||
    !uuidPattern.test(event.correlationId) ||
    !/^[a-z][a-z0-9.:-]{0,99}$/.test(event.type) ||
    !Number.isInteger(event.version) ||
    event.version < 1
  )
    throw new BadRequestException("Invalid outbox event");
  const serialized = JSON.stringify(event.payload);
  if (
    !serialized ||
    serialized.length > 4096 ||
    /"(?:password|otp|token|secret|authorization|signedUrl)"\s*:/i.test(
      serialized,
    )
  ) {
    throw new BadRequestException("Unsafe outbox payload");
  }
}

@Injectable()
export class OutboxWriter {
  async append(tx: TransactionContext, event: OutboxMessage): Promise<void> {
    validateOutboxMessage(event);
    await tx.outboxEvent.create({
      data: {
        eventId: event.eventId,
        type: event.type,
        version: event.version,
        payload: event.payload as object,
        correlationId: event.correlationId,
        aggregateType: event.type,
        aggregateId: event.eventId,
        dedupeKey: event.eventId,
      },
    });
  }
}
