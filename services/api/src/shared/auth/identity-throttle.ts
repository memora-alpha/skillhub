import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  HttpException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { createHmac } from "node:crypto";
import { RedisService } from "../../infrastructure/cache/redis.service";
import { IdentityConfig } from "../../configs/identity.config";
import { requestRateDimensions } from "./request-rate-limit.policy";

type RateLimitResult = {
  limit: number;
  remaining: number;
  resetSeconds: number;
};

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
        // Stop at the first exhausted dimension; later counters must not advance.
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
  async request(request: Request): Promise<RateLimitResult> {
    try {
      const policy = requestRateDimensions(request, {
        requestLimit: this.config.requestLimit,
        deviceHmacKey: this.config.deviceHmacKey,
      });
      let tightest: RateLimitResult | undefined;
      for (const dimension of policy.dimensions) {
        const digest = createHmac("sha256", this.config.jwtKey)
          .update(`${policy.group}:${dimension.kind}:${dimension.value}`)
          .digest("hex");
        const raw = await this.redis.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('PTTL',KEYS[1])}",
          1,
          `request:throttle:${digest}`,
          this.config.throttleWindowMs,
        );
        const count = Array.isArray(raw) ? Number(raw[0]) : Number.NaN;
        const ttlMs = Array.isArray(raw) ? Number(raw[1]) : Number.NaN;
        if (!Number.isFinite(count) || !Number.isFinite(ttlMs))
          throw new Error("RATE_LIMIT_COUNTER_INVALID");
        const result = {
          limit: dimension.limit,
          remaining: Math.max(0, dimension.limit - count),
          resetSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
        };
        if (
          !tightest ||
          result.remaining / result.limit < tightest.remaining / tightest.limit
        )
          tightest = result;
        if (count > dimension.limit)
          throw new HttpException(
            { message: "RATE_LIMITED", rateLimit: result },
            429,
          );
      }
      if (!tightest) throw new Error("RATE_LIMIT_POLICY_EMPTY");
      return tightest;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException("RATE_LIMIT_STORE_UNAVAILABLE");
    }
  }
}
@Injectable()
export class SharedRequestGuard implements CanActivate {
  constructor(private readonly throttle: IdentityThrottle) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getClass().name !== "HealthController") {
      const http = context.switchToHttp();
      const result = await this.throttle.request(http.getRequest<Request>());
      rateLimitHeaders(http.getResponse<Response>(), result);
    }
    return true;
  }
}

function rateLimitHeaders(response: Response, result: RateLimitResult) {
  response.setHeader("RateLimit-Limit", String(result.limit));
  response.setHeader("RateLimit-Remaining", String(result.remaining));
  response.setHeader("RateLimit-Reset", String(result.resetSeconds));
}
