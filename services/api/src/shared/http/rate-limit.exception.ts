import { HttpException } from "@nestjs/common";

export type RateLimitDetails = {
  limiter: string;
  scope: string;
  dimension: string;
  retryAfterSeconds: number;
  resetAt: string;
};

export class RateLimitException extends HttpException {
  readonly details: RateLimitDetails;
  constructor(
    code: string,
    limiter: string,
    scope: string,
    dimension: string,
    retryAfterMs: number,
  ) {
    super(code, 429);
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    this.details = {
      limiter,
      scope,
      dimension,
      retryAfterSeconds,
      resetAt: new Date(Date.now() + retryAfterSeconds * 1000).toISOString(),
    };
  }
}
