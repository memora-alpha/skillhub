import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import pngjs from "pngjs";
import jsQR from "jsqr";

// Independent synthetic oracle. No encoder import, live payload, HTTP or auth.
const fixtures = {
  ascii: "SYNTHETIC ONLY",
  unicode: "  synthetic raw\nĐồng e\u0301 € 😀\r\n ",
  dense: "synthetic-dense:" + "x".repeat(420),
  markup: '<svg onload="synthetic-only">& https://example.invalid/qr</svg>',
};
const producers = {
  L: "encoder-raster-fixture",
  W: "mounted-app-svg-screenshot",
  NA: "device-screenshot",
  NI: "device-screenshot",
};
function requireValue(value) {
  if (!value) throw new Error("Invalid QR validation input");
}

export function validateQrScreenshot({
  imagePath,
  fixture,
  layer,
  provenancePath,
}) {
  requireValue(
    Object.hasOwn(fixtures, fixture) && Object.hasOwn(producers, layer),
  );
  requireValue(
    fs.statSync(imagePath).size <= 8 * 1024 * 1024 &&
      fs.statSync(provenancePath).size <= 65536,
  );
  const image = fs.readFileSync(imagePath);
  requireValue(
    image.length >= 24 &&
      image.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
  );
  const width = image.readUInt32BE(16),
    height = image.readUInt32BE(20);
  requireValue(
    width > 0 &&
      width === height &&
      width <= 4096 &&
      width * height <= 4_000_000,
  );
  const provenance = JSON.parse(fs.readFileSync(provenancePath, "utf8"));
  const imageSha256 = createHash("sha256").update(image).digest("hex");
  requireValue(
    provenance.layer === layer &&
      provenance.fixture === fixture &&
      provenance.producer === producers[layer] &&
      provenance.imageSha256 === imageSha256,
  );
  requireValue(
    typeof provenance.sourceRevision === "string" &&
      provenance.sourceRevision.length &&
      typeof provenance.build === "string" &&
      provenance.build.length &&
      provenance.pixelRatio > 0,
  );
  if (layer !== "L")
    requireValue(
      provenance.viewport?.width > 0 && provenance.viewport?.height > 0,
    );
  if (layer === "NA" || layer === "NI")
    requireValue(
      typeof provenance.device === "string" && provenance.device.length,
    );
  const png = pngjs.PNG.sync.read(image, { checkCRC: true });
  const decoded = jsQR(new Uint8ClampedArray(png.data), width, height, {
    inversionAttempts: "dontInvert",
  });
  const expected = Buffer.from(fixtures[fixture], "utf8");
  requireValue(
    decoded &&
      decoded.data === fixtures[fixture] &&
      Buffer.from(decoded.binaryData).equals(expected),
  );
  const renderedQuietZoneModules = provenance.renderedQuietZoneModules ?? 4;
  requireValue(
    Number.isInteger(renderedQuietZoneModules) &&
      renderedQuietZoneModules >= 4 &&
      renderedQuietZoneModules <= 8,
  );
  const units = decoded.version * 4 + 17 + 2 * renderedQuietZoneModules;
  const modulePixels = width / units;
  requireValue(Number.isInteger(modulePixels) && modulePixels >= 2);
  const quiet = 4 * modulePixels;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (x >= quiet && x < width - quiet && y >= quiet && y < height - quiet)
        continue;
      const at = (y * width + x) * 4;
      requireValue(
        png.data[at] >= 250 &&
          png.data[at + 1] >= 250 &&
          png.data[at + 2] >= 250 &&
          png.data[at + 3] === 255,
      );
    }
  return {
    fixture,
    layer,
    pixelDecode: "PASS",
    rawUtf8Match: true,
    quietZoneModules: 4,
    renderedQuietZoneModules,
    modulePixels,
    width,
    height,
    imageSha256,
    producerDeclared: provenance.producer,
    provenanceCheck:
      "hash-and-fields; capture provenance must be reviewed separately",
    financialAcceptance: false,
  };
}

function main(args) {
  if (args.length === 1 && args[0] === "--help") {
    console.log(
      "node scripts/wallet-qr-validation.mjs --image <cropped-PNG> --fixture ascii|unicode|dense|markup --layer L|W|NA|NI --provenance <JSON>",
    );
    console.log(
      "Only synthetic pixels; layer/producer/fixture/SHA256/revision/build/pixelRatio required. W/native also need viewport; native needs device. Capture provenance is not certified by this decoder.",
    );
    return;
  }
  const values = new Map();
  for (let i = 0; i < args.length; i += 2) {
    requireValue(
      ["--image", "--fixture", "--layer", "--provenance"].includes(args[i]) &&
        args[i + 1] &&
        !values.has(args[i]),
    );
    values.set(args[i], args[i + 1]);
  }
  requireValue(values.size === 4);
  console.log(
    JSON.stringify(
      validateQrScreenshot({
        imagePath: values.get("--image"),
        fixture: values.get("--fixture"),
        layer: values.get("--layer"),
        provenancePath: values.get("--provenance"),
      }),
    ),
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main(process.argv.slice(2));
  } catch {
    console.error(
      "QR validation failed: missing/invalid input, provenance, geometry or payload mismatch.",
    );
    process.exitCode = 1;
  }
}
