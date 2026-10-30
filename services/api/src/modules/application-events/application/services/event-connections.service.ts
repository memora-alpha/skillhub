import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { RateLimitException } from "../../../../shared/http/rate-limit.exception";
import { randomUUID } from "node:crypto";
import { RedisService } from "../../../../infrastructure/cache/redis.service";
import { EventConfig } from "../../domain/event-config";
// One atomic script leases every dimension. No process-local limits under multiple instances.
const acquire = `local now=tonumber(ARGV[1]); local blocked=0; local wait=0; for i,key in ipairs(KEYS) do redis.call('ZREMRANGEBYSCORE',key,'-inf',now); local count=redis.call('ZCARD',key); local limit=tonumber(ARGV[i+3]); if count>=limit then local boundary=redis.call('ZRANGE',key,count-limit,count-limit,'WITHSCORES'); local remaining=tonumber(boundary[2])-now; if remaining>wait then blocked=i; wait=remaining end end end; if blocked>0 then return {0,blocked,wait} end; for _,key in ipairs(KEYS) do redis.call('ZADD',key,now+60000,ARGV[2]); redis.call('PEXPIRE',key,120000) end; return {1,0,0}`;
@Injectable()
export class EventConnectionsService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: EventConfig,
  ) {}
  async acquire(userId: string, sessionId: string, ip: string) {
    const id = randomUUID(),
      keys = [
        `sse:{leases}:user:${userId}`,
        `sse:{leases}:session:${sessionId}`,
        `sse:{leases}:ip:${ip}`,
        "sse:{leases}:global",
      ];
    let ok: unknown;
    try {
      ok = await this.redis.eval(
        acquire,
        4,
        ...keys,
        Date.now(),
        id,
        "unused",
        this.config.values.user,
        this.config.values.session,
        this.config.values.ip,
        this.config.values.global,
      );
    } catch {
      throw new ServiceUnavailableException("EVENT_CONNECTIONS_UNAVAILABLE");
    }
    if (
      !Array.isArray(ok) ||
      ok.length !== 3 ||
      !ok.every((value) => Number.isFinite(Number(value)))
    )
      throw new ServiceUnavailableException("EVENT_CONNECTIONS_UNAVAILABLE");
    const [accepted, dimension = 0, wait = 0] = ok.map(Number);
    if (accepted !== 0 && accepted !== 1)
      throw new ServiceUnavailableException("EVENT_CONNECTIONS_UNAVAILABLE");
    if (accepted === 0)
      throw new RateLimitException(
        "EVENT_CONNECTION_LIMIT",
        "sse",
        "connect",
        ["unknown", "user", "session", "ip", "global"][dimension] ?? "unknown",
        wait,
      );

    return {
      renew: async () => {
        const renewed = await this.redis.eval(
          `local now=tonumber(ARGV[1]); for _,key in ipairs(KEYS) do local expiry=redis.call('ZSCORE',key,ARGV[2]); if not expiry or tonumber(expiry)<=now then return 0 end end; for _,key in ipairs(KEYS) do redis.call('ZADD',key,'XX',now+60000,ARGV[2]); redis.call('PEXPIRE',key,120000) end; return 1`,
          4,
          ...keys,
          Date.now(),
          id,
        );
        if (renewed !== 1) throw new Error("EVENT_LEASE_EXPIRED");
      },
      release: async () => {
        await Promise.allSettled(keys.map((key) => this.redis.zrem(key, id)));
      },
    };
  }
}
