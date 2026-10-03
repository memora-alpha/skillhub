import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  HttpException,
} from "@nestjs/common";
import { Request } from "express";
import { createHmac } from "node:crypto";
import { RedisService } from "../../infrastructure/cache/redis.service";
import { IdentityConfig } from "../../configs/identity.config";

@Injectable()
export class IdentityThrottle {
  constructor(
    private readonly redis: RedisService,
    private readonly config: IdentityConfig,
  ) {}
  async check(
    purpose: string,
    email: string,
    ip: string,
    device: string,
  ): Promise<void> {
    const values = [
      ["email", email, this.config.emailLimit],
      ["ip", ip, this.config.ipLimit],
      ["device", device, this.config.deviceLimit],
    ] as const;
    try {
      for (const [kind, value, limit] of values) {
        const digest = createHmac("sha256", this.config.jwtKey)
          .update(`${purpose}:${kind}:${value}`)
          .digest("hex");
        const count = Number(
          await this.redis.eval(
            "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return n",
            1,
            `identity:throttle:${digest}`,
            this.config.throttleWindowMs,
          ),
        );
        if (count > limit) throw new HttpException("RATE_LIMITED", 429);
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    }
  }
  async request(ip: string) {
    try {
      const key = createHmac("sha256", this.config.jwtKey)
        .update(`request:${ip}`)
        .digest("hex");
      const count = Number(
        await this.redis.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return n",
          1,
          `identity:request:${key}`,
          this.config.throttleWindowMs,
        ),
      );
      if (count > this.config.requestLimit)
        throw new HttpException("RATE_LIMITED", 429);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    }
  }
}
@Injectable()
export class SharedRequestGuard implements CanActivate {
  constructor(private readonly throttle: IdentityThrottle) {}
  async canActivate(context: ExecutionContext) {
    if (context.getClass().name === "HealthController") return true;
    await this.throttle.request(
      context.switchToHttp().getRequest<Request>().ip ?? "unknown",
    );
    return true;
  }
}
