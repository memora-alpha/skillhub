import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Logger as NestLogger, ValidationPipe } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import helmet from "helmet";
import { setupSwagger } from "./configs/swagger.config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const config = app.get(ConfigService);
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: config.getOrThrow<string>("CORS_ORIGIN"),
    exposedHeaders: ["x-request-id", "x-correlation-id"],
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
