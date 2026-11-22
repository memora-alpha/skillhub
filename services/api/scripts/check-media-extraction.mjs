import assert from "node:assert/strict";
import sharp from "sharp";
import { ConfigService } from "@nestjs/config";
import { MediaTextExtractor } from "../dist/modules/content-moderation/infrastructure/media-text-extractor.js";

function samplePdf() {
  const text = "BT /F1 32 Tf 46 620 Td (SkillHub practice) Tj ET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length} >>\nstream\n${text}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return String(offset).padStart(10, "0");
  });
  return Buffer.from(
    pdf +
      `xref\n0 6\n0000000000 65535 f \n` +
      offsets.map((offset) => `${offset} 00000 n \n`).join("") +
      `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${pdf.length}\n%%EOF\n`,
  );
}

async function check(stage, run) {
  const started = performance.now();
  try {
    await run();
    console.log(
      JSON.stringify({
        stage,
        ok: true,
        elapsedMs: Math.round(performance.now() - started),
      }),
    );
  } catch (error) {
    console.log(
      JSON.stringify({
        stage,
        ok: false,
        code: error.code ?? error.name,
        message: error.message,
      }),
    );
    process.exitCode = 1;
  }
}

const extractor = new MediaTextExtractor(new ConfigService(process.env));
const pdf = samplePdf();
await check("png-ocr", async () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="140"><rect width="900" height="140" fill="white"/><text x="25" y="90" font-family="DejaVu Sans" font-size="48">Bài tập SkillHub</text></svg>';
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const text = await extractor.ocr(await extractor.canonicalImage(png));
  assert.match(text, /SkillHub/i);
});
await check("pdf-text", async () => {
  assert.equal(await extractor.pdfPageCount(pdf), 1);
  assert.match(await extractor.pdfText(pdf), /SkillHub/i);
});
await check("pdf-render-ocr", async () => {
  assert.match(
    await extractor.ocr(await extractor.pdfPage(pdf, 1)),
    /SkillHub/i,
  );
});
