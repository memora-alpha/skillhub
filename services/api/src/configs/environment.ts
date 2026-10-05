import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGIN: z.url(),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//),
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
  REDIS_URL: z.string().regex(/^rediss?:\/\//),
  API_RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(120),
  API_RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60_000),
  STORAGE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_REGION: z.string().min(1).optional(),
  STORAGE_BUCKET: z.string().min(1).optional(),
  STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  CLAMAV_HOST: z.string().min(1).optional(),
  CLAMAV_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
});

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
  const config = result.data;
  if (config.NODE_ENV === "production") {
    const failures: string[] = [];
    const database = new URL(config.DATABASE_URL);
    const mongo = new URL(config.MONGODB_URI);
    const redis = new URL(config.REDIS_URL);
    const only = (url: URL, key: string, expected: string) =>
      url.searchParams.getAll(key).length === 1 &&
      url.searchParams.get(key) === expected;
    if (
      !only(database, "sslmode", "verify-full") ||
      database.searchParams.has("sslaccept") ||
      (database.searchParams.has("sslcert") &&
        !database.searchParams.has("sslrootcert"))
    )
      failures.push("DATABASE_URL");
    if (
      !only(mongo, "tls", "true") ||
      [
        "tlsInsecure",
        "tlsAllowInvalidCertificates",
        "tlsAllowInvalidHostnames",
      ].some((key) =>
        mongo.searchParams.getAll(key).some((value) => value !== "false"),
      )
    )
      failures.push("MONGODB_URI");
    if (
      redis.protocol !== "rediss:" ||
      redis.searchParams.has("rejectUnauthorized")
    )
      failures.push("REDIS_URL");
    if (!config.CORS_ORIGIN.startsWith("https://"))
      failures.push("CORS_ORIGIN");
    if (failures.length)
      throw new Error(
        `Invalid environment configuration: ${failures.join(", ")}`,
      );
  }
  if (config.STORAGE_ENABLED) {
    const required = [
      "STORAGE_ENDPOINT",
      "STORAGE_REGION",
      "STORAGE_BUCKET",
      "STORAGE_ACCESS_KEY_ID",
      "STORAGE_SECRET_ACCESS_KEY",
      "CLAMAV_HOST",
      "CLAMAV_PORT",
    ] as const;
    const missing = required.filter((key) => !config[key]);
    if (missing.length)
      throw new Error(
        `Invalid environment configuration: ${missing.join(", ")}`,
      );
    if (
      config.NODE_ENV === "production" &&
      !config.STORAGE_ENDPOINT?.startsWith("https://")
    ) {
      throw new Error("Invalid environment configuration: STORAGE_ENDPOINT");
    }
  }
  return result.data;
}
