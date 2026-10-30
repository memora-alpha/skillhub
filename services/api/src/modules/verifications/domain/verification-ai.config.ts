import { z } from "zod";

const settings = z.object({
  GEMINI_API_KEY: z.string().trim().min(20).max(256),
  GEMINI_MODEL: z
    .string()
    .regex(/^gemini-[a-z0-9.-]+$/)
    .default("gemini-2.5-flash"),
  GEMINI_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(120000)
    .default(60000),
  GEMINI_MAX_OUTPUT_TOKENS: z.coerce
    .number()
    .int()
    .min(1024)
    .max(16384)
    .default(8192),
  GEMINI_MAX_INPUT_TOKENS: z.coerce
    .number()
    .int()
    .min(4096)
    .max(100000)
    .default(16000),
  VERIFICATION_AI_MAX_RUNS: z.coerce.number().int().min(1).max(20).default(3),
});

export type VerificationAiConfiguration = {
  enabled: boolean;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  maxInputTokens: number;
  maxRuns: number;
};

/** Validate names only in errors: never echo credentials or provider responses. */
export function verificationAiConfiguration(
  input: Record<string, unknown>,
): VerificationAiConfiguration {
  const flag = input.VERIFICATION_AI_ENABLED ?? "false";
  if (flag !== "true" && flag !== "false")
    throw new Error("Invalid AI configuration: VERIFICATION_AI_ENABLED");
  if (flag === "false")
    return {
      enabled: false,
      apiKey: "",
      model: "gemini-2.5-flash",
      timeoutMs: 60000,
      maxOutputTokens: 8192,
      maxInputTokens: 16000,
      maxRuns: 3,
    };
  const parsed = settings.safeParse(input);
  if (!parsed.success) {
    const names = [
      ...new Set(parsed.error.issues.map((issue) => issue.path[0])),
    ];
    throw new Error(`Invalid AI configuration: ${names.join(", ")}`);
  }
  return {
    enabled: true,
    apiKey: parsed.data.GEMINI_API_KEY,
    model: parsed.data.GEMINI_MODEL,
    timeoutMs: parsed.data.GEMINI_TIMEOUT_MS,
    maxOutputTokens: parsed.data.GEMINI_MAX_OUTPUT_TOKENS,
    maxInputTokens: parsed.data.GEMINI_MAX_INPUT_TOKENS,
    maxRuns: parsed.data.VERIFICATION_AI_MAX_RUNS,
  };
}

export const AI_PROMPT_VERSION = "skill-evidence-v1";
export const AI_MAX_ATTEMPTS = 3;
export const AI_EVENT = "skill.verification.ai.requested";
export const AI_QUEUE = "verification-ai";
export const VERIFICATION_AI_CONFIG = Symbol("VERIFICATION_AI_CONFIG");
export const AI_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export class VerificationAiError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable = false,
  ) {
    super(code);
    this.name = "VerificationAiError";
  }
}
