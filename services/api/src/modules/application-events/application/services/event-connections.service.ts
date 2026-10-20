import {
  Injectable,
  ServiceUnavailableException,
  HttpException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RedisService } from "../../../../infrastructure/cache/redis.service";
import { EventConfig } from "../../domain/event-config";
// One atomic script leases every dimension. No process-local limits under multiple instances.
const acquire = `local now=tonumber(ARGV[1]); for i,key in ipairs(KEYS) do redis.call('ZREMRANGEBYSCORE',key,'-inf',now); if redis.call('ZCARD',key)>=tonumber(ARGV[i+3]) then return 0 end end; for _,key in ipairs(KEYS) do redis.call('ZADD',key,now+60000,ARGV[2]); redis.call('PEXPIRE',key,120000) end; return 1`;
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
    if (ok !== 1) throw new HttpException("EVENT_CONNECTION_LIMIT", 429);
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
