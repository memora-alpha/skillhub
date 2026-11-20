import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";
import {
  defaultModerationModel,
  defaultModerationTimeoutMs,
} from "../domain/moderation-config";
import {
  moderationFlags,
  type ProviderClassification,
} from "../domain/moderation-policy";

export type ModerationProviderInput =
  | string
  | (
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    )[];

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
        const response = await fetch("https://api.openai.com/v1/moderations", {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          redirect: "error",
          signal: AbortSignal.timeout(
            Number(
              this.config.get(
                "CONTENT_MODERATION_TIMEOUT_MS",
                defaultModerationTimeoutMs,
              ),
            ),
          ),
          body: JSON.stringify({
            model: this.config.get(
              "CONTENT_MODERATION_MODEL",
              defaultModerationModel,
            ),
            input,
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
    } catch {
      // Provider responses and transport errors may contain submitted content.
    }
    throw new Error("MODERATION_PROVIDER_UNAVAILABLE");
  }
}
