import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { redisConnectionOptions } from "../../configs/redis.config";

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnectionOptions(
          config.getOrThrow<string>("REDIS_URL"),
        ),
        prefix: "skillhub",
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 1000,
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
