import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { MediaTextExtractor } from "../infrastructure/media-text-extractor";
import { moderationPolicyVersion } from "../domain/moderation-policy";
import {
  ContentModerationService,
  type ModerationAssessment,
  type ModerationInput,
} from "./content-moderation.service";

export type MediaModerationInput = {
  surface: "media" | "report_evidence";
  version: string;
  digest: string;
  mime: string;
  bytes: Buffer;
  filename?: string;
};

const imageTypes: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const textLimit = 32_000;

function combineAi(first: ModerationAssessment, second: ModerationAssessment) {
  if (first.outcome !== "ALLOW") return first;
  if (second.outcome !== "ALLOW") return second;
  return first.observedOutcome && first.observedOutcome !== "ALLOW"
    ? first
    : second;
}

@Injectable()
export class MediaModerationService {
  constructor(
    private readonly moderation: ContentModerationService,
    private readonly extractor: MediaTextExtractor,
  ) {}

  async assess(input: MediaModerationInput): Promise<ModerationAssessment> {
    return this.assessFile(input);
  }

  private async assessFile(
    input: MediaModerationInput,
  ): Promise<ModerationAssessment> {
    const partial = {
      ...this.base(input),
      outcome: "REVIEW" as const,
      reasonCodes: ["MEDIA_REVIEW_REQUIRED"],
    };
    try {
      const name = input.filename ?? "";
      const local = await this.checkLocalText(input, name);
      if (local) return local;
      const filename = await this.checkAiText(input, name);
      if (imageTypes.has(input.mime))
        return await this.image(
          input,
          await this.extractor.canonicalImage(input.bytes),
          filename,
        );
      if (input.mime === "application/pdf") {
        const pages = await this.extractor.pdfPageCount(input.bytes);
        let last = filename;
        for (let page = 1; page <= pages; page++) {
          last = await this.image(
            input,
            await this.extractor.pdfPage(input.bytes, page),
            last,
          );
          if (last.reasonCodes.some((code) => code.startsWith("PROFANITY:")))
            return last;
        }
        return last;
      }
      if (input.mime === "text/plain") {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(
          input.bytes,
        );
        const local = await this.checkLocalText(input, text);
        if (local) return local;
        return filename.outcome === "ALLOW"
          ? combineAi(filename, await this.checkAiText(input, text))
          : filename;
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      // Extractor output and diagnostics can contain the file's content.
    }
    return partial;
  }

  private base(input: MediaModerationInput) {
    return {
      sourceVersion: input.version,
      digest: input.digest,
      policyVersion: moderationPolicyVersion,
    };
  }

  private async image(
    input: MediaModerationInput,
    bytes: Buffer,
    previous: ModerationAssessment,
  ) {
    const text = await this.extractor.ocr(bytes);
    const local = await this.checkLocalText(input, text);
    if (local) return local;
    if (previous.outcome !== "ALLOW") return previous;
    const visual = combineAi(
      previous,
      await this.moderation.evaluateAi({
        ...this.base(input),
        surface: input.surface,
        image: { mimeType: "image/png", bytes },
      }),
    );
    if (visual.outcome !== "ALLOW") return visual;
    return text.trim()
      ? combineAi(visual, await this.checkAiText(input, text))
      : visual;
  }

  private async checkLocalText(input: MediaModerationInput, text: string) {
    const base = this.base(input);
    if (text.length > textLimit)
      return {
        ...base,
        outcome: "REVIEW" as const,
        reasonCodes: ["MEDIA_TEXT_LIMIT"],
      };
    const local = await this.moderation.assessProfanity?.({
      ...base,
      surface: input.surface,
      text,
    });
    return local?.outcome === "BLOCK" ? local : undefined;
  }

  private async checkAiText(
    input: MediaModerationInput,
    text: string,
  ): Promise<ModerationAssessment> {
    const base = this.base(input);
    const body: ModerationInput = { ...base, surface: input.surface };
    let last: ModerationAssessment = {
      ...base,
      outcome: "ALLOW",
      reasonCodes: [],
    };
    for (let start = 0; start < text.length; start += 3500) {
      last = combineAi(
        last,
        await this.moderation.evaluateAi({
          ...body,
          text: text.slice(start, start + 4000),
        }),
      );
      if (last.outcome !== "ALLOW") return last;
    }
    return last;
  }
}
