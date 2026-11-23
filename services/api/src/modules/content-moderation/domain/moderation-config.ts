import { z } from "zod";
import {
  type ModerationMode,
  type ModerationSurface,
  moderationSurfaces,
} from "./moderation-policy";

export const defaultModerationModel = "omni-moderation-latest";
export const defaultModerationTimeoutMs = 2000;
export const defaultModerationImageTimeoutMs = 6000;

const modeSchema = z.enum(["off", "observe", "enforce"]);
const surfaceSchema = z.enum(moderationSurfaces);
const settingsSchema = z.object({
  OPENAI_API_KEY: z.string().trim().optional(),
  CONTENT_MODERATION_MODEL: z
    .enum([defaultModerationModel, "omni-moderation-2024-09-26"])
    .default(defaultModerationModel),
  CONTENT_MODERATION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(30000)
    .default(defaultModerationTimeoutMs),
  CONTENT_MODERATION_IMAGE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(30000)
    .optional(),
  CONTENT_MODERATION_MODES: z.string().trim().default(""),
  CONTENT_MODERATION_OCR_COMMAND: z.string().trim().min(1).optional(),
  CONTENT_MODERATION_PDFINFO_COMMAND: z.string().trim().min(1).optional(),
  CONTENT_MODERATION_PDFTOPPM_COMMAND: z.string().trim().min(1).optional(),
});

export function moderationModes(
  raw: string,
): ReadonlyMap<ModerationSurface, ModerationMode> {
  const modes = new Map<ModerationSurface, ModerationMode>();
  if (!raw) return modes;
  for (const entry of raw.split(",")) {
    const [surface, mode, extra] = entry.trim().split(":");
    const key = surfaceSchema.safeParse(surface);
    const value = modeSchema.safeParse(mode);
    if (
      !key.success ||
      !value.success ||
      extra !== undefined ||
      modes.has(key.data)
    )
      throw new Error(
        "Invalid environment configuration: CONTENT_MODERATION_MODES",
      );
    modes.set(key.data, value.data);
  }
  return modes;
}

export function validateModerationSettings(env: Record<string, unknown>): void {
  const parsed = settingsSchema.safeParse(env);
  if (!parsed.success) {
    const fields = new Set(
      parsed.error.issues.map(({ path }) => path.join(".")),
    );
    throw new Error(
      `Invalid environment configuration: ${[...fields].join(", ")}`,
    );
  }
  const modes = moderationModes(parsed.data.CONTENT_MODERATION_MODES);
  if (
    [...modes.values()].some((mode) => mode !== "off") &&
    !parsed.data.OPENAI_API_KEY
  )
    throw new Error("Invalid environment configuration: OPENAI_API_KEY");
}
