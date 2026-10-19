import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  OutboxPublisherRegistry,
  type OutboxMessage,
  type OutboxPublisher,
} from "../../infrastructure/events/outbox.types";
import { LearningSessionsService } from "./learning-sessions.service";

@Injectable()
export class SessionCompletionHandler implements OnModuleInit, OutboxPublisher {
  constructor(
    private readonly registry: OutboxPublisherRegistry,
    private readonly sessions: LearningSessionsService,
  ) {}
  onModuleInit() {
    this.registry.register("learning-path.sessions-completed", this);
  }
  async publish(event: OutboxMessage) {
    const payload = event.payload;
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      typeof payload.pathId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(payload.pathId) ||
      event.version !== 1
    )
      throw new Error("INVALID_SESSION_COMPLETION_EVENT");
    await this.sessions.trySettleCompletedPath(payload.pathId);
  }
}
