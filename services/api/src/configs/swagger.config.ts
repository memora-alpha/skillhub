import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("SkillHub API")
    .setDescription(
      "Backend API contracts. Business endpoints are added per feature.",
    )
    .setVersion("0.1.0")
    .addServer("https://skillhub.memora.cam")
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    "api/docs",
    app,
    SwaggerModule.createDocument(app, config),
  );
}
