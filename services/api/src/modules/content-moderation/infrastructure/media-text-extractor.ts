import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { spawn } from "node:child_process";
import sharp from "sharp";
import { extractDocx } from "./docx-content";

export const maximumModeratedPdfPages = 12;

export class MediaExtractionError extends Error {
  constructor(
    readonly code: string,
    readonly retryable = false,
  ) {
    super(code);
  }
}

function parseWith(
  command: string,
  args: string[],
  bytes: Buffer,
  maxOutput: number,
  stage: string,
  signal?: AbortSignal,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      timeout: 10_000,
      signal,
      stdio: ["pipe", "pipe", "ignore"],
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        WINDIR: process.env.WINDIR,
        TESSDATA_PREFIX: process.env.TESSDATA_PREFIX,
        LC_ALL: "C",
      },
    });
    const chunks: Buffer[] = [];
    let count = 0;
    const fail = (code: string, retryable = false) =>
      reject(new MediaExtractionError(code, retryable));
    child.on("error", () => fail(`MEDIA_${stage}_UNAVAILABLE`, true));
    child.stdout.on("data", (chunk: Buffer) => {
      count += chunk.length;
      if (count > maxOutput) {
        child.kill();
        fail(`MEDIA_${stage}_OUTPUT_LIMIT`);
        return;
      }
      chunks.push(chunk);
    });
    child.on("close", (code, signal) => {
      if (code === 0 && count <= maxOutput)
        resolve(Buffer.concat(chunks, count));
      else if (signal) fail(`MEDIA_${stage}_TIMEOUT`, true);
      else fail(`MEDIA_${stage}_FAILED`);
    });
    child.stdin.on("error", () => {
      /* close reports the command failure */
    });
    child.stdin.end(bytes);
  });
}

@Injectable()
export class MediaTextExtractor {
  private readonly logger = new Logger(MediaTextExtractor.name);
  private languagesReady?: Promise<void>;
  private languageRetryAt = 0;

  constructor(private readonly config: ConfigService) {}

  async canonicalImage(bytes: Buffer): Promise<Buffer> {
    try {
      const image = sharp(bytes, {
        limitInputPixels: 25_000_000,
        animated: true,
      });
      if (((await image.metadata()).pages ?? 1) > 1)
        throw new MediaExtractionError("MODERATION_ANIMATED_IMAGE_UNSUPPORTED");
      return await image
        .rotate()
        .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
    } catch (error) {
      if (error instanceof MediaExtractionError) throw error;
      throw new MediaExtractionError("MEDIA_IMAGE_INVALID");
    }
  }

  async ocr(bytes: Buffer, signal?: AbortSignal): Promise<string> {
    const started = performance.now();
    const executable = this.config
      .get("CONTENT_MODERATION_OCR_COMMAND", "tesseract")
      .trim();
    if (
      !this.languagesReady ||
      (this.languageRetryAt && Date.now() >= this.languageRetryAt)
    ) {
      this.languageRetryAt = 0;
      this.languagesReady = this.requireOcrLanguages(executable).catch(
        (error: unknown) => {
          this.languageRetryAt = Date.now() + 2_000;
          throw error;
        },
      );
    }
    await this.languagesReady;
    const text = await parseWith(
      executable,
      ["stdin", "stdout", "-l", "vie+eng"],
      bytes,
      128_000,
      "OCR",
      signal,
    );
    this.logger.log({
      ocr_duration_ms: Math.round(performance.now() - started),
    });
    return new TextDecoder("utf-8", { fatal: true }).decode(text);
  }

  private async requireOcrLanguages(executable: string): Promise<void> {
    const output = await parseWith(
      executable,
      ["--list-langs"],
      Buffer.alloc(0),
      32_000,
      "OCR_PROBE",
    );
    const languages = new Set(
      output
        .toString("utf8")
        .split(/\r?\n/)
        .map((line) => line.trim()),
    );
    if (!languages.has("vie") || !languages.has("eng"))
      throw new MediaExtractionError(
        "MODERATION_OCR_LANGUAGES_UNAVAILABLE",
        true,
      );
  }

  async pdfPageCount(
    bytes: Buffer,
    maximumPages = maximumModeratedPdfPages,
    signal?: AbortSignal,
  ): Promise<number> {
    const output = await parseWith(
      this.config.get("CONTENT_MODERATION_PDFINFO_COMMAND", "pdfinfo").trim(),
      ["-"],
      bytes,
      32_000,
      "PDF_INFO",
      signal,
    );
    const pages = Number(
      /^Pages:\s+([1-9]\d*)\s*$/mu.exec(output.toString("utf8"))?.[1],
    );
    if (!Number.isSafeInteger(pages) || pages > maximumPages)
      throw new MediaExtractionError("MODERATION_PDF_PAGE_LIMIT");
    return pages;
  }

  async pdfPage(
    bytes: Buffer,
    page: number,
    signal?: AbortSignal,
  ): Promise<Buffer> {
    const rendered = await parseWith(
      this.config.get("CONTENT_MODERATION_PDFTOPPM_COMMAND", "pdftoppm").trim(),
      [
        "-f",
        String(page),
        "-l",
        String(page),
        "-scale-to",
        "1600",
        "-singlefile",
        "-png",
        "-",
      ],
      bytes,
      10_000_000,
      "PDF_RENDER",
      signal,
    );
    return this.canonicalImage(rendered).catch(() => {
      throw new MediaExtractionError("MEDIA_PDF_RENDER_FAILED");
    });
  }

  async pdfText(bytes: Buffer, signal?: AbortSignal): Promise<string> {
    const started = performance.now();
    const output = await parseWith(
      "pdftotext",
      ["-enc", "UTF-8", "-", "-"],
      bytes,
      128_000,
      "PDF_TEXT",
      signal,
    );
    this.logger.log({
      text_extraction_duration_ms: Math.round(performance.now() - started),
      format: "pdf",
    });
    return new TextDecoder("utf-8", { fatal: true }).decode(output);
  }

  async docx(bytes: Buffer) {
    const started = performance.now();
    try {
      const result = await extractDocx(bytes);
      this.logger.log({
        text_extraction_duration_ms: Math.round(performance.now() - started),
        format: "docx",
      });
      return result;
    } catch {
      throw new MediaExtractionError("MEDIA_DOCX_UNREADABLE");
    }
  }
}
