import core from "qrcode/lib/core/qrcode";

type ReadyQr = Readonly<{
  kind: "ready";
  size: number;
  modules: readonly number[];
  quietZone: 4;
  errorCorrection: "M";
}>;
export type QrEncoding =
  | ReadyQr
  | Readonly<{
      kind: "error";
      reason: "invalid-text" | "capacity" | "unavailable";
    }>;

function validText(text: string) {
  if (!text.length) return false;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

// Matrix-only library entry: no canvas/PNG/fs/CLI or remote QR endpoint.
// Raw text lives with its scoped caller, never inside the encoded result/errors.
export function encodePaymentQr(raw: string): QrEncoding {
  if (!validText(raw)) return { kind: "error", reason: "invalid-text" };
  if (typeof TextEncoder !== "function")
    return { kind: "error", reason: "unavailable" };
  // Bound work to the backend parser's text bound; actual byte capacity is lower.
  if (raw.length > 4096) return { kind: "error", reason: "capacity" };
  try {
    const { size, data } = core.create([{ data: raw, mode: "byte" }], {
      errorCorrectionLevel: "M",
    }).modules;
    if (
      !Number.isInteger(size) ||
      size < 21 ||
      size > 177 ||
      data.length !== size * size ||
      data.some((value) => value !== 0 && value !== 1)
    )
      return { kind: "error", reason: "unavailable" };
    return Object.freeze({
      kind: "ready",
      size,
      modules: Object.freeze(Array.from(data)),
      quietZone: 4,
      errorCorrection: "M",
    });
  } catch (error) {
    // Do not echo library errors containing the payload. No replacement intent.
    return {
      kind: "error",
      reason:
        error instanceof Error &&
        error.message.includes("amount of data is too big")
          ? "capacity"
          : "unavailable",
    };
  }
}

export function paymentQrGeometry(
  code: ReadyQr,
  available: number,
  pixelRatio: number,
) {
  if (
    !Number.isFinite(available) ||
    available <= 0 ||
    !Number.isFinite(pixelRatio) ||
    pixelRatio <= 0
  )
    return null;
  // One extra white module protects the required four clean modules against
  // subpixel viewport/capture phase and SVG edge antialiasing on each platform.
  const quietZone = code.quietZone + 1;
  const units = code.size + 2 * quietZone;
  const modulePixels = Math.floor(
    (Math.min(available, 320) * pixelRatio) / units,
  );
  if (modulePixels < 2) return null;
  let path = "";
  for (let y = 0; y < code.size; y++) {
    for (let x = 0; x < code.size;) {
      if (!code.modules[y * code.size + x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < code.size && code.modules[y * code.size + x]) x++;
      const run = x - start;
      path += `M${start + quietZone} ${y + quietZone}h${run}v1h-${run}z`;
    }
  }
  return {
    units,
    quietZone,
    modulePixels,
    offset:
      Math.floor((available * pixelRatio - modulePixels * units) / 2) /
      pixelRatio,
    side: (modulePixels * units) / pixelRatio,
    path,
  };
}
