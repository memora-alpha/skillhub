import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
const positive = (value: number, max: number) =>
  z.coerce.number().int().positive().max(max).default(value);
const schema = z.object({
  secret: z.string().min(32),
  heartbeatMs: positive(15000, 30000),
  retryMs: positive(3000, 60000),
  bufferBytes: positive(256 * 1024, 1024 * 1024),
  drainTimeoutMs: positive(5000, 30000),
  rows: positive(10000, 1000000),
  user: positive(3, 100),
  session: positive(2, 100),
  ip: positive(20, 10000),
  global: positive(1000, 100000),
});
export function eventSettings(input: unknown) {
  return schema.parse(input);
}
@Injectable()
export class EventConfig {
  readonly values;
  constructor(config: ConfigService) {
    this.values = eventSettings({
      secret:
        config.get("EVENT_CURSOR_KEY") ?? config.getOrThrow("IDENTITY_JWT_KEY"),
      heartbeatMs: config.get("EVENT_HEARTBEAT_MS"),
      retryMs: config.get("EVENT_RETRY_MS"),
      bufferBytes: config.get("EVENT_BUFFER_BYTES"),
      drainTimeoutMs: config.get("EVENT_DRAIN_TIMEOUT_MS"),
      rows: config.get("EVENT_REPLAY_MAX_ROWS"),
      user: config.get("EVENT_CONNECTIONS_PER_USER"),
      session: config.get("EVENT_CONNECTIONS_PER_SESSION"),
      ip: config.get("EVENT_CONNECTIONS_PER_IP"),
      global: config.get("EVENT_CONNECTIONS_GLOBAL"),
    });
  }
}
