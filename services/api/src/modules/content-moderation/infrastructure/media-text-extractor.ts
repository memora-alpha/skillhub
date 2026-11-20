import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { spawn } from "node:child_process";
import sharp from "sharp";

export const maximumModeratedPdfPages = 12;

function parseWith(
  command: string,
  args: string[],
  bytes: Buffer,
  maxOutput: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      timeout: 10_000,
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
    const fail = () => reject(new Error("MODERATION_MEDIA_EXTRACTION_FAILED"));
    child.on("error", fail);
    child.stdout.on("data", (chunk: Buffer) => {
      count += chunk.length;
      if (count > maxOutput) {
        child.kill();
        fail();
        return;
      }
      chunks.push(chunk);
    });
    child.on("close", (code) => {
      if (code === 0 && count <= maxOutput)
        resolve(Buffer.concat(chunks, count));
      else fail();
    });
    child.stdin.on("error", fail);
    child.stdin.end(bytes);
  });
}

@Injectable()
export class MediaTextExtractor {
  private languagesReady?: Promise<void>;

  constructor(private readonly config: ConfigService) {}

  async canonicalImage(bytes: Buffer): Promise<Buffer> {
    const image = sharp(bytes, {
      limitInputPixels: 25_000_000,
      animated: true,
    });
    if (((await image.metadata()).pages ?? 1) > 1)
      throw new Error("MODERATION_ANIMATED_IMAGE_UNSUPPORTED");
    return image
      .rotate()
      .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  }

  async ocr(bytes: Buffer): Promise<string> {
    const executable = this.config
      .get("CONTENT_MODERATION_OCR_COMMAND", "tesseract")
      .trim();
    this.languagesReady ??= this.requireOcrLanguages(executable);
    await this.languagesReady;
    const text = await parseWith(
      executable,
      ["stdin", "stdout", "-l", "vie+eng"],
      bytes,
      128_000,
    );
    return new TextDecoder("utf-8", { fatal: true }).decode(text);
  }

  private async requireOcrLanguages(executable: string): Promise<void> {
    const output = await parseWith(
      executable,
      ["--list-langs"],
      Buffer.alloc(0),
      32_000,
    );
    const languages = new Set(
      output
        .toString("utf8")
        .split(/\r?\n/)
        .map((line) => line.trim()),
    );
    if (!languages.has("vie") || !languages.has("eng"))
      throw new Error("MODERATION_OCR_LANGUAGES_UNAVAILABLE");
  }

  async pdfPageCount(bytes: Buffer): Promise<number> {
    const output = await parseWith(
      this.config.get("CONTENT_MODERATION_PDFINFO_COMMAND", "pdfinfo").trim(),
      ["-"],
      bytes,
      32_000,
    );
    const pages = Number(
      /^Pages:\s+([1-9]\d*)\s*$/mu.exec(output.toString("utf8"))?.[1],
    );
    if (!Number.isSafeInteger(pages) || pages > maximumModeratedPdfPages)
      throw new Error("MODERATION_PDF_PAGE_LIMIT");
    return pages;
  }

  async pdfPage(bytes: Buffer, page: number): Promise<Buffer> {
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
    );
    return this.canonicalImage(rendered);
  }
}
