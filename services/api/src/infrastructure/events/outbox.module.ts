import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { OutboxDispatcher } from "./outbox-dispatcher";
import { OutboxConsumer } from "./outbox-consumer";
import { OutboxPublisherRegistry } from "./outbox.types";
import { OutboxWriter } from "./outbox-writer";

@Module({
  imports: [DatabaseModule],
  providers: [
    OutboxWriter,
    OutboxPublisherRegistry,
    OutboxDispatcher,
    OutboxConsumer,
  ],
  exports: [
    OutboxWriter,
    OutboxPublisherRegistry,
    OutboxDispatcher,
    OutboxConsumer,
  ],
})
export class OutboxModule {}
