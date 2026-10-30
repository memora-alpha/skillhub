import { z } from "zod";
import { VerificationAiProvider } from "../../application/ports/verification-ai.provider";
import {
  aiFileResultSchema,
  parseAiFileResult,
} from "../../domain/verification-ai.types";
import { VERIFICATION_AI_PROMPT } from "../../domain/verification-ai.prompt";
import {
  VerificationAiError,
  type VerificationAiConfiguration,
} from "../../domain/verification-ai.config";

// Gemini's constrained decoder rejects deeply nested length/regex/date bounds.
// Keep shape/enums in the request; enforce every bound with Zod on the response.
const decoderBounds = new Set([
  "$schema",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "minItems",
  "maxItems",
  "pattern",
  "format",
]);
const geminiResultSchema: unknown = JSON.parse(
  JSON.stringify(z.toJSONSchema(aiFileResultSchema), (key, value: unknown) =>
    decoderBounds.has(key) ? undefined : value,
  ),
);

const responseSchema = z.object({
  candidates: z
    .array(
      z.object({
        finishReason: z.string(),
        content: z.object({
          parts: z.array(
            z.object({
              text: z.string().optional(),
              thought: z.boolean().optional(),
            }),
          ),
        }),
      }),
    )
    .min(1),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().int().nonnegative().default(0),
      totalTokenCount: z.number().int().nonnegative().default(0),
    })
    .optional(),
});

async function boundedResponse(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new VerificationAiError("AI_INVALID_RESPONSE", true);
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > 1000000)
        throw new VerificationAiError("AI_RESPONSE_TOO_LARGE");
      chunks.push(Buffer.from(next.value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Fixed Google endpoint, key in a header, no tools or third-party URL fetching. */
export class GeminiVerificationAdapter extends VerificationAiProvider {
  constructor(
    private readonly config: VerificationAiConfiguration,
    private readonly http: typeof fetch = fetch,
  ) {
    super();
  }

  async analyze(input: Parameters<VerificationAiProvider["analyze"]>[0]) {
    if (!this.config.enabled) throw new VerificationAiError("AI_DISABLED");
    const context = {
      currentDate: input.currentDate,
      applicant: input.snapshot.applicant,
      skill: input.snapshot.skill,
      reviewPolicy: input.snapshot.reviewPolicy,
      evidence: {
        evidenceId: input.file.evidenceId,
        mimeType: input.file.mimeType,
        title: input.file.title,
        description: input.file.description,
      },
    };
    try {
      const signal = AbortSignal.timeout(this.config.timeoutMs);
      const request = {
        systemInstruction: { parts: [{ text: VERIFICATION_AI_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              { text: `INPUT_CONTEXT\n${JSON.stringify(context)}` },
              {
                inlineData: {
                  mimeType: input.file.mimeType,
                  data: input.bytes.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: this.config.maxOutputTokens,
          responseMimeType: "application/json",
          responseJsonSchema: geminiResultSchema,
          thinkingConfig: this.config.model.startsWith("gemini-2.5-")
            ? { thinkingBudget: 1024 }
            : { thinkingLevel: "low" },
        },
      };
      // Count all text/media before generation: small compressed PDFs can contain many pages.
      const count = z
        .object({ totalTokens: z.number().int().nonnegative() })
        .safeParse(
          await this.post(
            "countTokens",
            {
              generateContentRequest: {
                model: `models/${this.config.model}`,
                ...request,
              },
            },
            signal,
          ),
        );
      if (!count.success)
        throw new VerificationAiError("AI_INVALID_RESPONSE", true);
      if (count.data.totalTokens > this.config.maxInputTokens)
        throw new VerificationAiError("AI_INPUT_TOKEN_LIMIT");
      const raw = responseSchema.safeParse(
        await this.post("generateContent", request, signal),
      );
      if (!raw.success)
        throw new VerificationAiError("AI_INVALID_RESPONSE", true);
      const candidate = raw.data.candidates[0]!;
      if (candidate.finishReason !== "STOP")
        throw new VerificationAiError("AI_INCOMPLETE_RESPONSE", true);
      const text = candidate.content.parts
        .filter((part) => !part.thought)
        .map((part) => part.text ?? "")
        .join("");
      const result = parseAiFileResult(JSON.parse(text), input.file);
      const inputTokens = raw.data.usageMetadata?.promptTokenCount ?? 0;
      const totalTokens = raw.data.usageMetadata?.totalTokenCount ?? 0;
      return {
        result,
        usage: {
          inputTokens,
          outputTokens: Math.max(0, totalTokens - inputTokens),
          totalTokens,
        },
      };
    } catch (error) {
      if (error instanceof VerificationAiError) throw error;
      // Never propagate raw response bodies, headers, prompts or provider errors.
      throw new VerificationAiError("AI_REQUEST_FAILED", true);
    }
  }

  private async post(
    method: "generateContent" | "countTokens",
    payload: unknown,
    signal: AbortSignal,
  ) {
    const response = await this.http(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:${method}`,
      {
        method: "POST",
        redirect: "error",
        signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.config.apiKey,
        },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      if (response.status === 401 || response.status === 403)
        throw new VerificationAiError("AI_PROVIDER_AUTHENTICATION");
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429
      )
        throw new VerificationAiError("AI_PROVIDER_REQUEST_REJECTED");
      throw new VerificationAiError(
        "AI_PROVIDER_UNAVAILABLE",
        response.status === 429 || response.status >= 500,
      );
    }
    return boundedResponse(response);
  }
}
