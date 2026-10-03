import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { redisConnectionOptions } from "../../configs/redis.config";

@Injectable()
export class RedisService
  extends Redis
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    super({
      ...redisConnectionOptions(config.getOrThrow<string>("REDIS_URL")),
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      commandTimeout: 2000,
      maxRetriesPerRequest: 1,
    });
    this.on("error", () => {
      /* Readiness and startup report availability without logging credentials. */
    });
  }
  async onModuleInit() {
    await this.connect();
  }
  onModuleDestroy() {
    this.disconnect();
  }
}
