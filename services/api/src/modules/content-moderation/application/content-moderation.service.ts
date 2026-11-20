import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { moderationModes } from "../domain/moderation-config";
import {
  assessClassification,
  moderationPolicyVersion,
  type ModerationMode,
  type ModerationOutcome,
  type ModerationSurface,
} from "../domain/moderation-policy";
import {
  OpenAiModerationClient,
  type ModerationProviderInput,
} from "../infrastructure/openai-moderation.client";

export type ModerationInput = {
  surface: ModerationSurface;
  sourceVersion: string;
  digest: string;
  text?: string;
  image?: {
    mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    bytes: Buffer;
  };
};

export type ModerationAssessment = Pick<
  ModerationInput,
  "sourceVersion" | "digest"
> & {
  outcome: ModerationOutcome;
  observedOutcome?: ModerationOutcome;
  reasonCodes: string[];
  policyVersion: string;
  classifierVersion?: string;
  assessmentId?: string;
};

export function requireAllowed(assessment: ModerationAssessment): void {
  if (assessment.outcome === "RETRY")
    throw new ServiceUnavailableException(
      "CONTENT_MODERATION_TEMPORARILY_UNAVAILABLE",
    );
  if (assessment.outcome !== "ALLOW")
    throw new UnprocessableEntityException("CONTENT_MODERATION_BLOCKED");
}

function providerInput(input: ModerationInput): ModerationProviderInput {
  if (!input.image) return input.text ?? "";
  const { mimeType, bytes } = input.image;
  const parts: Exclude<ModerationProviderInput, string> = [
    {
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${bytes.toString("base64")}` },
    },
  ];
  if (input.text?.trim()) parts.unshift({ type: "text", text: input.text });
  return parts;
}

@Injectable()
export class ContentModerationService {
  private readonly logger = new Logger(ContentModerationService.name);
  private readonly modes: ReadonlyMap<ModerationSurface, ModerationMode>;

  constructor(
    config: ConfigService,
    private readonly provider: OpenAiModerationClient,
  ) {
    this.modes = moderationModes(
      config.get("CONTENT_MODERATION_MODES", "").trim(),
    );
  }

  mode(surface: ModerationSurface): ModerationMode {
    return this.modes.get(surface) ?? "off";
  }

  evaluateText(
    surface: ModerationSurface,
    sourceVersion: string,
    fields: readonly (string | null | undefined)[],
  ): Promise<ModerationAssessment> {
    const text = fields
      .filter((field) => typeof field === "string" && field.trim())
      .join("\n");
    const digest = createHash("sha256")
      .update(JSON.stringify(fields))
      .digest("hex");
    return this.evaluate({ surface, sourceVersion, digest, text });
  }

  async evaluate(input: ModerationInput): Promise<ModerationAssessment> {
    const mode = this.mode(input.surface);
    const base = {
      sourceVersion: input.sourceVersion,
      digest: input.digest,
      policyVersion: moderationPolicyVersion,
    };
    if (mode === "off" || (!input.text?.trim() && !input.image))
      return { ...base, outcome: "ALLOW", reasonCodes: [] };

    const started = performance.now();
    const assessment = await this.classify(providerInput(input));
    this.logger.log({
      surface: input.surface,
      mode,
      outcome: assessment.outcome,
      reasonCodes: assessment.reasonCodes,
      policyVersion: base.policyVersion,
      elapsedMs: Math.round(performance.now() - started),
    });
    if (mode === "observe")
      return {
        ...base,
        ...assessment,
        outcome: "ALLOW",
        observedOutcome: assessment.outcome,
      };
    return { ...base, ...assessment };
  }

  private async classify(input: ModerationProviderInput) {
    try {
      const result = await this.provider.classify(input);
      return {
        ...assessClassification(result),
        assessmentId: result.id,
        classifierVersion: result.model,
      };
    } catch {
      return {
        outcome: "RETRY" as const,
        reasonCodes: ["PROVIDER_UNAVAILABLE"],
      };
    }
  }
}
