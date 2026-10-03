import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { SkipThrottle } from "@nestjs/throttler";
import type { Connection } from "mongoose";
import { PrismaService } from "./infrastructure/database/prisma.service";
import { RedisService } from "./infrastructure/cache/redis.service";

@Controller("health")
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectConnection() private readonly mongo: Connection,
  ) {}
  @Get()
  getHealth() {
    return { status: "ok", service: "skillhub-api" };
  }

  @Get("ready")
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
    return { status: "ok", dependencies: names };
  }
}
