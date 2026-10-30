import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  HttpException,
} from "@nestjs/common";
import { Request } from "express";
import { createHmac } from "node:crypto";
import { RateLimitException } from "../http/rate-limit.exception";
import { requestRateScope } from "./request-rate-scope";
import { RedisService } from "../../infrastructure/cache/redis.service";
import { IdentityConfig } from "../../configs/identity.config";

@Injectable()
export class IdentityThrottle {
  constructor(
    private readonly redis: RedisService,
    private readonly config: IdentityConfig,
  ) {}
  private async count(
    scope: string,
    dimension: string,
    value: string,
    limit: number,
    limiter: string,
  ) {
    const digest = createHmac("sha256", this.config.jwtKey)
      .update(JSON.stringify([limiter, scope, dimension, value]))
      .digest("hex");
    try {
      const result = await this.redis.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 or redis.call('PTTL',KEYS[1])<0 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('PTTL',KEYS[1])}",
        1,
        `identity:limit:${digest}`,
        this.config.throttleWindowMs,
      );
      if (!Array.isArray(result) || result.length !== 2)
        throw new Error("Invalid throttle counter result");
      const [count, remaining] = result.map(Number);
      if (!Number.isFinite(count) || !Number.isFinite(remaining))
        throw new Error("Invalid throttle counter result");
      if (count! > limit)
        throw new RateLimitException(
          "RATE_LIMITED",
          limiter,
          scope,
          dimension,
          remaining!,
        );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    }
  }
  async check(
    purpose: string,
    subject: string,
    ip: string,
    agent: string,
  ): Promise<void> {
    // User-Agent is a client hint, not a device identity. Bind the legacy device
    // dimension to the subject and IP so unrelated users never share an agent-only key.
    const values = [
      ["subject", subject, this.config.emailLimit],
      ["ip", ip, this.config.ipLimit],
      ["client", JSON.stringify([subject, ip, agent]), this.config.deviceLimit],
    ] as const;
    // Stop at the first exhausted dimension; later counters must not advance.
    for (const [dimension, value, limit] of values)
      await this.count(purpose, dimension, value, limit, "auth");
  }
  async request(ip: string, scope = "all") {
    await this.count(scope, "ip", ip, this.config.requestLimit, "http");
  }
  async authenticated(
    principal: { userId: string; sessionId: string },
    scope: string,
  ) {
    await this.count(
      scope,
      "user",
      principal.userId,
      this.config.userRequestLimit ?? this.config.requestLimit,
      "http",
    );
    await this.count(
      scope,
      "session",
      principal.sessionId,
      this.config.sessionRequestLimit ?? this.config.requestLimit,
      "http",
    );
  }
}
@Injectable()
export class SharedRequestGuard implements CanActivate {
  constructor(private readonly throttle: IdentityThrottle) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getClass().name !== "HealthController") {
      await this.throttle.request(
        context.switchToHttp().getRequest<Request>().ip ?? "unknown",
        requestRateScope(context),
      );
    }
    return true;
  }
}
