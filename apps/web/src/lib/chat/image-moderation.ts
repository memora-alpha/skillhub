import {
  contactPolicyMessage,
  detectContactInformation,
} from "./contact-policy";
import {
  detectInappropriateText,
  imageModerationBlockedMessage,
} from "./content-policy";

export type NsfwPrediction = {
  className: string;
  probability: number;
};

export type ClientImageModerationResult =
  | { allowed: true; degraded?: boolean }
  | {
      allowed: false;
      reason: "nsfw" | "image-text-profanity" | "image-text-contact";
      message: string;
    };

/** Pure decision rule for NSFWJS class probabilities. */
export function shouldBlockNsfwPredictions(
  predictions: readonly NsfwPrediction[],
): boolean {
  const scores = new Map<string, number>();
  for (const item of predictions) {
    scores.set(item.className, item.probability);
  }
  const porn = scores.get("Porn") ?? 0;
  const hentai = scores.get("Hentai") ?? 0;
  const sexy = scores.get("Sexy") ?? 0;
  if (porn >= 0.55 || hentai >= 0.55) return true;
  if (sexy >= 0.85 && porn + sexy >= 0.9) return true;
  return false;
}

type NsfwModel = {
  classify: (
    img: HTMLCanvasElement | HTMLImageElement,
  ) => Promise<NsfwPrediction[]>;
};

type OcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
};

let nsfwModelPromise: Promise<NsfwModel> | null = null;
let ocrWorkerPromise: Promise<OcrWorker> | null = null;

async function getNsfwModel(): Promise<NsfwModel> {
  nsfwModelPromise ??= (async () => {
    const tf = await import("@tensorflow/tfjs");
    await tf.ready();
    const [{ load }, { MobileNetV2Model }] = await Promise.all([
      import("nsfwjs/core"),
      import("nsfwjs/models/mobilenet_v2"),
    ]);
    return (await load("MobileNetV2", {
      modelDefinitions: [MobileNetV2Model],
    })) as unknown as NsfwModel;
  })().catch((cause) => {
    nsfwModelPromise = null;
    throw cause;
  });
  return nsfwModelPromise;
}

async function getOcrWorker(): Promise<OcrWorker> {
  ocrWorkerPromise ??= (async () => {
    const tesseract = await import("tesseract.js");
    return (await tesseract.createWorker([
      "vie",
      "eng",
    ])) as unknown as OcrWorker;
  })().catch((cause) => {
    ocrWorkerPromise = null;
    throw cause;
  });
  return ocrWorkerPromise;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("CLIENT_MODERATION_TIMEOUT")),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function decodeImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
      element.src = objectUrl;
    });
    const maxDim = 640;
    const scale = Math.min(
      1,
      maxDim / Math.max(1, img.naturalWidth, img.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("CANVAS_UNAVAILABLE");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function isCheckableImageFile(file: File): boolean {
  return (
    ["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    /\.(jpe?g|png|webp)$/i.test(file.name)
  );
}

/**
 * Browser-side pre-moderation for chat images before uploading to the API:
 * 1. Visual NSFW classification via nsfwjs + TensorFlow.js.
 * 2. Vietnamese/English OCR via tesseract.js checked against profanity & contact rules.
 *
 * Falls back gracefully to backend moderation if browser models fail or time out.
 */
export async function moderateImageOnClient(
  file: File,
): Promise<ClientImageModerationResult> {
  if (typeof window === "undefined" || !isCheckableImageFile(file)) {
    return { allowed: true };
  }
  let canvas: HTMLCanvasElement;
  try {
    canvas = await decodeImageToCanvas(file);
  } catch {
    return { allowed: true, degraded: true };
  }

  let degraded = false;

  // 1. Visual NSFW classification
  try {
    const model = await withTimeout(getNsfwModel(), 10_000);
    const predictions = await withTimeout(model.classify(canvas), 6_000);
    if (shouldBlockNsfwPredictions(predictions)) {
      return {
        allowed: false,
        reason: "nsfw",
        message: imageModerationBlockedMessage,
      };
    }
  } catch {
    degraded = true;
  }

  // 2. OCR text check (catches meme profanity / contact info screenshots)
  try {
    const worker = await withTimeout(getOcrWorker(), 12_000);
    const result = await withTimeout(worker.recognize(canvas), 8_000);
    const extracted = result.data.text?.trim() ?? "";
    if (extracted) {
      if (detectInappropriateText(extracted)) {
        return {
          allowed: false,
          reason: "image-text-profanity",
          message: imageModerationBlockedMessage,
        };
      }
      if (detectContactInformation(extracted)) {
        return {
          allowed: false,
          reason: "image-text-contact",
          message: contactPolicyMessage,
        };
      }
    }
  } catch {
    degraded = true;
  }

  return degraded ? { allowed: true, degraded: true } : { allowed: true };
}
