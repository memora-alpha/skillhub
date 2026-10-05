import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { validateEnvironment } from "./configs/environment";
import {
  requestLogId,
  requestLogProperties,
  safeRequestLog,
} from "./configs/logging.config";
import { DatabaseModule } from "./infrastructure/database/database.module";
import { RedisModule } from "./infrastructure/cache/redis.module";
import { QueueModule } from "./infrastructure/queue/queue.module";
import { IdempotencyModule } from "./infrastructure/idempotency/idempotency.module";
import { OutboxModule } from "./infrastructure/events/outbox.module";
import { StorageModule } from "./infrastructure/storage/storage.module";
import { SystemConfigurationModule } from "./modules/system-configuration/system-configuration.module";
import { HttpExceptionFilter } from "./shared/http/http-exception.filter";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      validate: validateEnvironment,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>("LOG_LEVEL"),
          genReqId: requestLogId,
          customProps: requestLogProperties,
          serializers: { req: safeRequestLog },
          redact: [
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers.set-cookie",
          ],
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.getOrThrow<number>("API_RATE_LIMIT_TTL_MS"),
          limit: config.getOrThrow<number>("API_RATE_LIMIT_LIMIT"),
        },
      ],
    }),
    DatabaseModule,
    RedisModule,
    QueueModule,
    IdempotencyModule,
    OutboxModule,
    SystemConfigurationModule,
    StorageModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
