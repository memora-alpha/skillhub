import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { SharedRequestGuard } from "./shared/auth/identity-throttle";
import { LoggerModule } from "nestjs-pino";
import { validateEnvironment } from "./configs/environment";
import { DatabaseModule } from "./infrastructure/database/database.module";
import { RedisModule } from "./infrastructure/cache/redis.module";
import { QueueModule } from "./infrastructure/queue/queue.module";
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
    IdentityModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useExisting: SharedRequestGuard },
  ],
})
export class AppModule {}
