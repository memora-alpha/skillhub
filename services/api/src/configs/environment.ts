import { z } from "zod";
import { paymentConfiguration } from "../modules/payments/domain/payment-config";
import { liveKitConfiguration } from "../modules/learning-sessions/infrastructure/livekit/livekit.service";
import { verificationAiConfiguration } from "../modules/verifications/domain/verification-ai.config";

// Loose: identity, SMTP and S3 keys are validated by their own providers and must survive.
const environmentSchema = z.looseObject({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGIN: z.url(),
  DATABASE_URL: z.string().regex(/^postgres(?:ql)?:\/\//),
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
  REDIS_URL: z.string().regex(/^rediss?:\/\//),
  STORAGE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_REGION: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  CLAMAV_HOST: z.string().min(1).optional(),
  CLAMAV_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
});

type Environment = z.infer<typeof environmentSchema>;

function fail(fields: readonly string[]): void {
  if (fields.length)
    throw new Error(`Invalid environment configuration: ${fields.join(", ")}`);
}

/** Production connections must verify TLS; flags that weaken verification are rejected. */
function insecureProductionSettings(config: Environment): string[] {
  const failures: string[] = [];
  const database = new URL(config.DATABASE_URL);
  const mongo = new URL(config.MONGODB_URI);
  const redis = new URL(config.REDIS_URL);
  const only = (url: URL, key: string, expected: string) =>
    url.searchParams.getAll(key).length === 1 &&
    url.searchParams.get(key) === expected;
  const clientCertificateWithoutRoot =
    database.searchParams.has("sslcert") &&
    !database.searchParams.has("sslrootcert");
  if (
    !only(database, "sslmode", "verify-full") ||
    database.searchParams.has("sslaccept") ||
    clientCertificateWithoutRoot
  )
    failures.push("DATABASE_URL");
  const mongoBypass = [
    "tlsInsecure",
    "tlsAllowInvalidCertificates",
    "tlsAllowInvalidHostnames",
  ].some((key) =>
    mongo.searchParams.getAll(key).some((value) => value !== "false"),
  );
  if (!only(mongo, "tls", "true") || mongoBypass) failures.push("MONGODB_URI");
  if (
    redis.protocol !== "rediss:" ||
    redis.searchParams.has("rejectUnauthorized")
  )
    failures.push("REDIS_URL");
  if (!config.CORS_ORIGIN.startsWith("https://")) failures.push("CORS_ORIGIN");
  return failures;
}

/** Provider values are required only when storage is enabled. */
function invalidStorageSettings(config: Environment): string[] {
  const required = [
    "STORAGE_ENDPOINT",
    "STORAGE_REGION",
    "S3_BUCKET",
    "STORAGE_ACCESS_KEY_ID",
    "STORAGE_SECRET_ACCESS_KEY",
    "CLAMAV_HOST",
    "CLAMAV_PORT",
  ] as const;
  const missing = required.filter((key) => !config[key]);
  if (missing.length) return missing;
  const plainHttpInProduction =
    config.NODE_ENV === "production" &&
    !config.STORAGE_ENDPOINT?.startsWith("https://");
  return plainHttpInProduction ? ["STORAGE_ENDPOINT"] : [];
}

export function validateEnvironment(input: Record<string, unknown>) {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new Error(`Invalid environment configuration: ${fields.join(", ")}`);
  }
  const config = result.data;
  for (const name of ["DATABASE_URL", "MONGODB_URI", "REDIS_URL"] as const) {
    if (!URL.canParse(config[name])) fail([name]);
  }
  if (config.NODE_ENV === "production")
    fail(insecureProductionSettings(config));
  if (config.STORAGE_ENABLED) fail(invalidStorageSettings(config));
  paymentConfiguration(input);
  liveKitConfiguration(input);
  verificationAiConfiguration(input);
  return config;
}
