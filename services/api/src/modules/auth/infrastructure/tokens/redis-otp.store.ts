import { Injectable } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { RedisService } from "../../../../infrastructure/cache/redis.service";
import { IdentityConfig } from "../../../../configs/identity.config";

import { OtpStore, OtpRecord } from "../../application/ports/otp-store";

@Injectable()
export class RedisOtpStore extends OtpStore {
  constructor(
    private readonly redis: RedisService,
    private readonly config: IdentityConfig,
  ) {
    super();
  }
  // Hash tags keep address keys together; addresses never appear in Redis keys.
  key(email: string, purpose: string): string {
    const address = createHmac("sha256", this.config.jwtKey)
      .update(email)
      .digest("hex");
    return `identity:otp:{${address}}:${purpose}`;
  }
  private addressKey(email: string): string {
    return this.key(email, "").slice(0, -1);
  }
  async issue(
    email: string,
    purpose: string,
    record: OtpRecord,
    expectedId?: string,
  ): Promise<boolean> {
    const key = this.key(email, purpose);
    const now = Date.now();
    const hour = Math.floor(now / 3600000);
    return (
      Number(
        await this.redis.eval(
          `
      if redis.call('EXISTS',KEYS[2]) == 1 or redis.call('EXISTS',KEYS[4]) == 1 or redis.call('EXISTS',KEYS[5]) == 1 then return 0 end
      if ARGV[5]=='REGISTER' then
        local current=redis.call('GET',KEYS[1])
        if ARGV[4]~='' then
          if not current or cjson.decode(current).id~=ARGV[4] then return 0 end
        elseif current then return 0 end
      end
      if tonumber(redis.call('GET',KEYS[3]) or '0') >= 5 then return 0 end
      redis.call('SET',KEYS[1],ARGV[1],'PX',ARGV[2])
      redis.call('SET',KEYS[2],'1','EX',60)
      local n=redis.call('INCR',KEYS[3]); if n==1 then redis.call('PEXPIRE',KEYS[3],ARGV[3]) end
      return 1`,
          5,
          key,
          `${key}:cooldown`,
          `${key}:hour:${hour}`,
          `${key}:claim`,
          `${this.addressKey(email)}:ban`,
          JSON.stringify(record),
          record.expiresAt - now,
          (hour + 1) * 3600000 - now,
          expectedId ?? "",
          purpose,
        ),
      ) === 1
    );
  }
  async read(email: string, purpose: string): Promise<OtpRecord | null> {
    const value = await this.redis.get(this.key(email, purpose));
    return value ? (JSON.parse(value) as OtpRecord) : null;
  }
  async claim(
    email: string,
    purpose: string,
    id: string,
    digest: string,
    lease: string,
  ): Promise<boolean> {
    const key = this.key(email, purpose);
    return (
      Number(
        await this.redis.eval(
          `
      local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end
      local row=cjson.decode(raw)
      if row.id~=ARGV[1] or row.failedAttempts>=5 or redis.call('EXISTS',KEYS[2])==1 or redis.call('EXISTS',KEYS[4])==1 then return 0 end
      if row.digest~=ARGV[2] then
        row.failedAttempts=row.failedAttempts+1
        local failures=redis.call('INCR',KEYS[3]); if failures==1 then redis.call('EXPIRE',KEYS[3],86400) end
        if failures>=5 then redis.call('SET',KEYS[4],'1','EX',86400) end
        redis.call('SET',KEYS[1],cjson.encode(row),'KEEPTTL'); return 0
      end
      redis.call('SET',KEYS[2],ARGV[3],'EX',60); return 1`,
          4,
          key,
          `${key}:claim`,
          `${this.addressKey(email)}:failures`,
          `${this.addressKey(email)}:ban`,
          id,
          digest,
          lease,
        ),
      ) === 1
    );
  }
  async finish(
    email: string,
    purpose: string,
    id: string,
    lease: string,
    consumed: boolean,
  ): Promise<void> {
    const key = this.key(email, purpose);
    await this.redis.eval(
      `
      if redis.call('GET',KEYS[2])~=ARGV[2] then return 0 end
      local raw=redis.call('GET',KEYS[1])
      if raw and cjson.decode(raw).id==ARGV[1] and ARGV[3]=='1' then redis.call('DEL',KEYS[1]) end
      redis.call('DEL',KEYS[2]); return 1`,
      2,
      key,
      `${key}:claim`,
      id,
      lease,
      consumed ? "1" : "0",
    );
  }
}
