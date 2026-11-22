import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import {
  MediaExtractionError,
  MediaTextExtractor,
} from "../infrastructure/media-text-extractor";
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
export const docxMime =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function supportsMediaModeration(mime: string): boolean {
  return (
    imageTypes.has(mime) ||
    mime === "application/pdf" ||
    mime === "text/plain" ||
    mime === docxMime
  );
}

function combineAi(first: ModerationAssessment, second: ModerationAssessment) {
  const severity = { ALLOW: 0, REVIEW: 1, RETRY: 2, BLOCK: 3 };
  return severity[first.outcome] > severity[second.outcome] ||
    (first.outcome === second.outcome &&
      severity[first.observedOutcome ?? "ALLOW"] >=
        severity[second.observedOutcome ?? "ALLOW"])
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
      reasonCodes: ["MEDIA_FORMAT_UNSUPPORTED"],
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
        const text = await this.extractor.pdfText(input.bytes);
        let last = combineAi(filename, await this.assessText(input, text));
        for (let page = 1; page <= pages; page += 2) {
          const indexes = page < pages ? [page, page + 1] : [page];
          const assessed = await Promise.all(
            indexes.map(async (index) =>
              this.image(
                input,
                await this.extractor.pdfPage(input.bytes, index),
              ),
            ),
          );
          last = assessed.reduce(combineAi, last);
          if (last.reasonCodes.some((code) => code.startsWith("PROFANITY:")))
            return last;
        }
        return last;
      }
      if (input.mime === docxMime) {
        const { text, images } = await this.extractor.docx(input.bytes);
        let result = combineAi(filename, await this.assessText(input, text));
        for (const bytes of images) {
          if (result.reasonCodes?.some((code) => code.startsWith("PROFANITY:")))
            break;
          result = combineAi(
            result,
            await this.image(input, await this.extractor.canonicalImage(bytes)),
          );
        }
        return result;
      }
      if (input.mime === "text/plain") {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(
          input.bytes,
        );
        return combineAi(filename, await this.assessText(input, text));
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException)
        return {
          ...partial,
          outcome: "RETRY",
          reasonCodes: ["MEDIA_CONFIGURATION_UNAVAILABLE"],
        };
      if (error instanceof MediaExtractionError)
        return {
          ...partial,
          outcome: error.retryable ? "RETRY" : "REVIEW",
          reasonCodes: [error.code],
        };
      return { ...partial, reasonCodes: ["MEDIA_EXTRACTION_FAILED"] };
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
    previous?: ModerationAssessment,
  ) {
    const [text, image] = await Promise.all([
      this.extractor.ocr(bytes),
      this.moderation.evaluateAi({
        ...this.base(input),
        surface: input.surface,
        image: { mimeType: "image/png", bytes },
      }),
    ]);
    const visual = previous ? combineAi(previous, image) : image;
    return combineAi(visual, await this.assessText(input, text));
  }

  private async assessText(input: MediaModerationInput, text: string) {
    return (
      (await this.checkLocalText(input, text)) ?? this.checkAiText(input, text)
    );
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
