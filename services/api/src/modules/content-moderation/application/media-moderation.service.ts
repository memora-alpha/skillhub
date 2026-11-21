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

function classified(assessment: ModerationAssessment): ModerationAssessment {
  return {
    ...assessment,
    outcome: assessment.observedOutcome ?? assessment.outcome,
  };
}

@Injectable()
export class MediaModerationService {
  constructor(
    private readonly moderation: ContentModerationService,
    private readonly extractor: MediaTextExtractor,
  ) {}

  async assess(input: MediaModerationInput): Promise<ModerationAssessment> {
    const mode = this.moderation.mode(input.surface);
    const result = await this.assessFile(input);
    if (mode === "observe" && result.observedOutcome !== undefined)
      return { ...result, outcome: "ALLOW" };
    return result;
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
      const filename = await this.checkText(input, input.filename ?? "");
      if (filename.outcome !== "ALLOW") return filename;
      if (imageTypes.has(input.mime))
        return await this.image(
          input,
          await this.extractor.canonicalImage(input.bytes),
        );
      if (input.mime === "application/pdf") {
        const pages = await this.extractor.pdfPageCount(input.bytes);
        let last = filename;
        for (let page = 1; page <= pages; page++) {
          last = await this.image(
            input,
            await this.extractor.pdfPage(input.bytes, page),
          );
          if (last.outcome !== "ALLOW") return last;
        }
        return last;
      }
      if (input.mime === "text/plain")
        return await this.checkText(
          input,
          new TextDecoder("utf-8", { fatal: true }).decode(input.bytes),
        );
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

  private async image(input: MediaModerationInput, bytes: Buffer) {
    const text = await this.extractor.ocr(bytes);
    const local = await this.checkLocalText(input, text);
    if (local) return local;
    const visual = classified(
      await this.moderation.evaluate({
        ...this.base(input),
        surface: input.surface,
        image: { mimeType: "image/png", bytes },
      }),
    );
    if (visual.outcome !== "ALLOW") return visual;
    return text.trim() ? this.checkText(input, text) : visual;
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

  private async checkText(
    input: MediaModerationInput,
    text: string,
  ): Promise<ModerationAssessment> {
    const base = this.base(input);
    const local = await this.checkLocalText(input, text);
    if (local) return local;
    const body: ModerationInput = { ...base, surface: input.surface };
    let last: ModerationAssessment = {
      ...base,
      outcome: "ALLOW",
      reasonCodes: [],
    };
    for (let start = 0; start < text.length; start += 3500) {
      last = classified(
        await this.moderation.evaluate({
          ...body,
          text: text.slice(start, start + 4000),
        }),
      );
      if (last.outcome !== "ALLOW") return last;
    }
    return last;
  }
}
