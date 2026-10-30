import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import {
  Logger as NestLogger,
  ValidationPipe,
  VersioningType,
} from "@nestjs/common";
import { Logger } from "nestjs-pino";
import helmet from "helmet";
import { trustedProxySetting } from "./configs/proxy.config";
import { setupSwagger } from "./configs/swagger.config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const config = app.get(ConfigService);
  app.useBodyParser("json", {
    type: ["application/json", "application/webhook+json"],
    limit: "100kb",
  });

  app.set(
    "trust proxy",
    trustedProxySetting(config.get<string>("TRUSTED_PROXY_CIDRS")),
  );
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI });
  app.enableCors({
    origin: config.getOrThrow<string>("CORS_ORIGIN"),
    exposedHeaders: ["x-request-id", "x-correlation-id", "Retry-After"],
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  if (config.get<string>("NODE_ENV") !== "production") setupSwagger(app);
  await app.listen(config.getOrThrow<number>("PORT"));
}

void bootstrap().catch(() => {
  NestLogger.error(
    "API startup failed. Check configuration and database availability.",
  );
  process.exit(1);
});
