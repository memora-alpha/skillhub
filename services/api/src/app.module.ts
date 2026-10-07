import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { SharedRequestGuard } from "./shared/auth/identity-throttle";
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
import { IdentityModule } from "./modules/identity.module";

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
            "req.body",
            "res.body",
          ],
        },
      }),
    }),
    DatabaseModule,
    RedisModule,
    QueueModule,
    IdempotencyModule,
    OutboxModule,
    SystemConfigurationModule,
    StorageModule,
    IdentityModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useExisting: SharedRequestGuard },
  ],
})
export class AppModule {}
