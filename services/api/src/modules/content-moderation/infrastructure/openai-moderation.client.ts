import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import sharp from "sharp";
import { z } from "zod";
import {
  defaultModerationModel,
  defaultModerationImageTimeoutMs,
  defaultModerationTimeoutMs,
} from "../domain/moderation-config";
import {
  moderationFlags,
  type ProviderClassification,
} from "../domain/moderation-policy";

export type ModerationProviderInput =
  | string
  | {
      text?: string;
      image: {
        mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
        bytes: Buffer;
      };
    };

export class ModerationProviderError extends Error {
  constructor(
    readonly reasonCode: "PROVIDER_UNAVAILABLE" | "PROVIDER_TIMEOUT",
  ) {
    super("MODERATION_PROVIDER_UNAVAILABLE");
  }
}

async function wireInput(input: ModerationProviderInput) {
  if (typeof input === "string") return input;
  const { bytes, mimeType } = input.image;
  const compress = mimeType === "image/png" && bytes.length > 1_000_000;
  const payload = compress
    ? await sharp(bytes, { limitInputPixels: 25_000_000 })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 82 })
        .toBuffer()
    : bytes;
  const mime = compress ? "image/jpeg" : mimeType;
  return [
    ...(input.text?.trim() ? [{ type: "text", text: input.text }] : []),
    {
      type: "image_url",
      image_url: { url: `data:${mime};base64,${payload.toString("base64")}` },
    },
  ];
}

const responseSchema = z.object({
  id: z.string().min(1).max(200),
  model: z.string().min(1).max(120),
  results: z.tuple([
    z.object({
      flagged: z.boolean(),
      categories: z
        .record(z.string(), z.boolean())
        .refine((flags) =>
          moderationFlags.every((name) => Object.hasOwn(flags, name)),
        ),
      category_scores: z
        .record(z.string(), z.number().min(0).max(1))
        .refine((scores) =>
          moderationFlags.every((name) => Object.hasOwn(scores, name)),
        ),
    }),
  ]),
});

@Injectable()
export class OpenAiModerationClient {
  constructor(private readonly config: ConfigService) {}

  async classify(
    input: ModerationProviderInput,
  ): Promise<ProviderClassification> {
    try {
      const apiKey = this.config.get<string>("OPENAI_API_KEY")?.trim();
      if (apiKey) {
        const payload = await wireInput(input);
        const timeout = Number(
          this.config.get(
            "CONTENT_MODERATION_TIMEOUT_MS",
            defaultModerationTimeoutMs,
          ),
        );
        const requestTimeout =
          typeof input === "string"
            ? timeout
            : Number(
                this.config.get(
                  "CONTENT_MODERATION_IMAGE_TIMEOUT_MS",
                  Math.max(timeout, defaultModerationImageTimeoutMs),
                ),
              );
        const response = await fetch("https://api.openai.com/v1/moderations", {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          redirect: "error",
          signal: AbortSignal.timeout(requestTimeout),
          body: JSON.stringify({
            model: this.config.get(
              "CONTENT_MODERATION_MODEL",
              defaultModerationModel,
            ),
            input: payload,
          }),
        });
        if (response.ok) {
          const { id, model, results } = responseSchema.parse(
            await response.json(),
          );
          return { id, model, ...results[0] };
        }
        await response.body?.cancel();
      }
    } catch (error) {
      // Provider responses and transport errors may contain submitted content.
      if (error instanceof Error && error.name === "TimeoutError")
        throw new ModerationProviderError("PROVIDER_TIMEOUT");
    }
    throw new ModerationProviderError("PROVIDER_UNAVAILABLE");
  }
}
