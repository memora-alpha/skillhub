import {
  Controller,
  Get,
  ServiceUnavailableException,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { SkipThrottle } from "@nestjs/throttler";
import type { Connection } from "mongoose";
import { PrismaService } from "./infrastructure/database/prisma.service";
import { RedisService } from "./infrastructure/cache/redis.service";
import { ApiProperty } from "@nestjs/swagger";
import {
  ApiSuccessResponse,
  ApiErrorResponse,
} from "./shared/http/api-response.decorators";
import { success } from "./shared/http/response";

class HealthResponse {
  @ApiProperty({ enum: ["ok"] }) status!: string;
  @ApiProperty({ enum: ["skillhub-api"] }) service!: string;
}

class ReadinessResponse {
  @ApiProperty({ enum: ["ok"] }) status!: string;
  @ApiProperty({ type: [String] }) dependencies!: string[];
}

@Controller({ path: "health", version: VERSION_NEUTRAL })
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectConnection() private readonly mongo: Connection,
  ) {}
  @Get()
  @ApiSuccessResponse(200, HealthResponse)
  getHealth() {
    return success(
      { status: "ok", service: "skillhub-api" },
      "Service is healthy.",
    );
  }

  @Get("ready")
  @ApiSuccessResponse(200, ReadinessResponse)
  @ApiErrorResponse(503, "Required storage unavailable")
  async getReadiness() {
    const results = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.mongo.db
        ? this.mongo.db.admin().ping()
        : Promise.reject(new Error("Disconnected")),
      this.redis.ping(),
    ]);
    const names = ["postgresql", "mongodb", "redis"];
    const unavailable = results.flatMap((result, index) =>
      result.status === "rejected" ? [names[index]] : [],
    );
    if (unavailable.length) throw new ServiceUnavailableException();
    return success({ status: "ok", dependencies: names }, "Service is ready.");
  }
}
