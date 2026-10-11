import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../infrastructure/database/database.module";
import { RedisModule } from "../../infrastructure/cache/redis.module";
import { OutboxModule } from "../../infrastructure/events/outbox.module";
import { IdentityModule } from "../identity.module";
import { ApplicationEventsService } from "./application/application-events.service";
import { EventConnectionsService } from "./application/event-connections.service";
import { EventsController } from "./presentation/events.controller";
import { EventConfig } from "./domain/event-config";
@Module({
  imports: [DatabaseModule, RedisModule, OutboxModule, IdentityModule],
  providers: [ApplicationEventsService, EventConnectionsService, EventConfig],
  controllers: [EventsController],
  exports: [ApplicationEventsService],
})
export class ApplicationEventsModule {}
