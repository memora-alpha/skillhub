import { z } from "zod";

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    CORS_ORIGIN: z.url(),
    DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//),
    MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
    REDIS_URL: z.string().regex(/^rediss?:\/\//),
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .default("info"),
  })
  .passthrough();

export function validateEnvironment(input: Record<string, unknown>) {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new Error(`Invalid environment configuration: ${fields.join(", ")}`);
  }
  for (const name of ["DATABASE_URL", "MONGODB_URI", "REDIS_URL"] as const) {
    try {
      new URL(result.data[name]);
    } catch {
      throw new Error(`Invalid environment configuration: ${name}`);
    }
  }
  return result.data;
}
