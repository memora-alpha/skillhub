import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  encodePaymentQr,
  paymentQrGeometry,
} from "../src/features/wallet/utils/payment-qr-encoder";
import { paymentQrFromObservation } from "../src/features/wallet/utils/payment-qr-model";
import { createQrPresentation } from "./fixtures/wallet-model-qr";
import { createQrPreviewHost } from "./fixtures/wallet-qr-host";

test("the isolated QR fixture needs no account intent or real payment", () => {
  const host = createQrPreviewHost();
  host.load("ascii");
  assert.equal(host.getSnapshot().status, "PENDING");
});
import {
  createPaymentObservation,
  reducePaymentObservation,
} from "../src/features/wallet/utils/payment-observation";
import { parsePayment } from "../src/features/wallet/schemas/payment-contracts";
import { paymentWire, paymentId } from "./fixtures/payment-api";
import { qrPayloads, decodableQrCases } from "./fixtures/wallet-qr-payloads";
import jsQR from "jsqr";

// L rasterization tests encoder/geometry only, never mounted-app/native proof.
function raster(
  code: Extract<ReturnType<typeof encodePaymentQr>, { kind: "ready" }>,
  scale = 4,
) {
  const width = (code.size + 8) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let row = 0; row < code.size; row++)
    for (let col = 0; col < code.size; col++) {
      if (!code.modules[row * code.size + col]) continue;
      for (let y = 0; y < scale; y++)
        for (let x = 0; x < scale; x++) {
          const at =
            (((row + 4) * scale + y) * width + (col + 4) * scale + x) * 4;
          pixels[at] = pixels[at + 1] = pixels[at + 2] = 0;
        }
    }
  return { pixels, width };
}

for (const name of decodableQrCases)
  test(`independent decoder preserves raw UTF-8 bytes: ${name}`, () => {
    const encoded = encodePaymentQr(qrPayloads[name]);
    assert.equal(encoded.kind, "ready");
    if (encoded.kind !== "ready")
      assert.fail("synthetic encoder fixture unavailable");
    assert.equal(encoded.quietZone, 4);
    assert.equal(encoded.errorCorrection, "M");
    const { pixels, width } = raster(encoded);
    const decoded = jsQR(pixels, width, width, {
      inversionAttempts: "dontInvert",
    });
    assert.ok(decoded, "independent QR decoder must find generated L pixels");
    assert.deepEqual(
      Buffer.from(decoded.binaryData),
      Buffer.from(qrPayloads[name], "utf8"),
    );
    assert.equal(decoded.data, qrPayloads[name]);
    assert.ok(Object.isFrozen(encoded));
    assert.ok(Object.isFrozen(encoded.modules));
    assert.equal("raw" in encoded, false);
    assert.equal("paymentStatus" in encoded, false);
  });

test("invalid text/capacity and unavailable TextEncoder fail closed without leaking payload", () => {
  for (const raw of ["", qrPayloads.invalid, "\udc00", "a\ud800b"])
    assert.deepEqual(encodePaymentQr(raw), {
      kind: "error",
      reason: "invalid-text",
    });
  assert.deepEqual(encodePaymentQr(qrPayloads.overCapacity), {
    kind: "error",
    reason: "capacity",
  });
  assert.deepEqual(encodePaymentQr("Đ".repeat(4096)), {
    kind: "error",
    reason: "capacity",
  });
  const original = Object.getOwnPropertyDescriptor(globalThis, "TextEncoder")!;
  try {
    Object.defineProperty(globalThis, "TextEncoder", {
      value: undefined,
      configurable: true,
    });
    assert.deepEqual(encodePaymentQr(qrPayloads.ascii), {
      kind: "error",
      reason: "unavailable",
    });
  } finally {
    Object.defineProperty(globalThis, "TextEncoder", original);
  }
});

test("layout uses integer physical modules and quiet zone, never clips or upscales a missing matrix", () => {
  const code = encodePaymentQr(qrPayloads.ascii);
  assert.equal(code.kind, "ready");
  if (code.kind !== "ready") assert.fail();
  for (const ratio of [1, 1.25, 2, 2.75, 3])
    for (const available of [224, 275, 330]) {
      const geometry = paymentQrGeometry(code, available, ratio);
      assert.ok(geometry);
      assert.ok(Number.isInteger(geometry.modulePixels));
      assert.ok(geometry.modulePixels >= 2);
      assert.ok(geometry.side <= available);
      // CSS/device layout is geometric, not money: fractional DPR division may
      // introduce a sub-epsilon JS error while physical module counts stay integer.
      assert.ok(
        Math.abs(
          geometry.side * ratio -
            geometry.modulePixels * (code.size + 2 * geometry.quietZone),
        ) < 1e-9,
      );
      assert.equal(geometry.path.includes("synthetic"), false);
    }
  for (const width of [0, -1, Number.NaN, 5])
    assert.equal(paymentQrGeometry(code, width, 1), null);
  for (const ratio of [0, -1, Number.NaN])
    assert.equal(paymentQrGeometry(code, 224, ratio), null);
});

const scope = { ownerId: "synthetic-owner-a", generation: 1 };
const initial = () => createPaymentObservation({ scope, paymentId });
type Observation = ReturnType<typeof initial>;
function apply(
  old: Observation,
  version = 1,
  hidden = false,
  status = "PENDING",
) {
  const wire = paymentWire(status, version);
  if (hidden) wire.checkout = null;
  return reducePaymentObservation(old, {
    scope,
    paymentId,
    ticket: 1,
    currentTicket: 1,
    data: parsePayment(wire),
  });
}
test("QR projection uses accepted owner/version only; same-version suppression cannot revive", () => {
  const ready = apply(initial());
  const shown = paymentQrFromObservation(ready, scope);
  assert.equal(shown.stage, "ready-model");
  assert.equal(shown.raw, ready.data?.checkout?.qrCode);
  const hidden = apply(ready, 1, true);
  assert.equal(paymentQrFromObservation(hidden, scope).raw, undefined);
  const late = apply(hidden, 1);
  assert.equal(paymentQrFromObservation(late, scope).raw, undefined);
  assert.equal(
    paymentQrFromObservation(apply(late, 2), scope).stage,
    "ready-model",
  );
  assert.equal(
    paymentQrFromObservation(apply(late, 2, true, "PAID"), scope).raw,
    undefined,
  );
  assert.equal(
    paymentQrFromObservation({ ...ready, stale: true }, scope).raw,
    undefined,
  );
});
test("scope replacement, logout, denial and unknown states expose no old QR or identity", () => {
  const ready = apply(initial());
  for (const next of [
    { ...scope, ownerId: "b" },
    { ...scope, generation: 2 },
  ]) {
    const hidden = paymentQrFromObservation(ready, next);
    assert.equal(hidden.raw, undefined);
    assert.equal(hidden.paymentId, undefined);
  }
  assert.equal(
    paymentQrFromObservation(ready, scope, false).paymentId,
    undefined,
  );
  assert.equal(paymentQrFromObservation(undefined, scope).raw, undefined);
  for (const state of [
    "CREATED",
    "REVIEW",
    "FUTURE_STATE",
    "FAILED",
    "EXPIRED",
    "REFUNDED",
  ])
    assert.equal(
      paymentQrFromObservation(apply(initial(), 1, true, state), scope).raw,
      undefined,
    );
});
test("encoder and model never perform financial/network/storage side effects", () => {
  for (const file of [
    "utils/payment-qr-encoder.ts",
    "utils/payment-qr-model.ts",
  ]) {
    const source = readFileSync(
      new URL("../src/features/wallet/" + file, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /fetch\(|\.request\(|SecureStore|localStorage|Linking|WebView|payment-intent|\.log\(/,
    );
  }
});

test("local render failure/retry/close preserve identity and never decide an outcome", () => {
  const qr = createQrPresentation(paymentId);
  qr.readyModel(qrPayloads.ascii);
  qr.renderError();
  assert.equal(qr.getSnapshot().paymentId, paymentId);
  qr.retryPresentation();
  assert.equal(qr.getSnapshot().raw, qrPayloads.ascii);
  qr.close();
  assert.equal(qr.getSnapshot().raw, undefined);
  assert.equal(qr.getSnapshot().paymentId, paymentId);
  assert.equal("status" in qr.getSnapshot(), false);
  qr.dispose();
  assert.equal(qr.getSnapshot().paymentId, undefined);
});

test("isolated QR preview exercises null/version/owner/denial without US2/create or account cache", () => {
  const host = createQrPreviewHost();
  host.load("unicode");
  assert.equal(host.getSnapshot().model.raw, qrPayloads.unicode);
  host.hide();
  host.restore();
  assert.equal(host.getSnapshot().model.raw, undefined);
  host.newer();
  assert.equal(host.getSnapshot().model.raw, qrPayloads.unicode);
  const id = host.getSnapshot().model.paymentId;
  host.fail();
  host.retry();
  assert.equal(host.getSnapshot().model.paymentId, id);
  host.close();
  assert.equal(host.getSnapshot().model.raw, undefined);
  host.reopen();
  assert.equal(host.getSnapshot().model.paymentId, id);
  host.switchOwner();
  assert.equal(host.getSnapshot().model.raw, undefined);
  host.late();
  assert.equal(host.getSnapshot().model.raw, undefined);
  host.load("ascii");
  assert.notEqual(host.getSnapshot().model.paymentId, id);
  host.deny();
  host.restore();
  assert.equal(host.getSnapshot().model.raw, undefined);
  host.dispose();
  assert.equal(host.getSnapshot().model.paymentId, undefined);
  const code = readFileSync(
    new URL("./fixtures/wallet-qr-host.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    code,
    /payment-intent|payment-preparation|useWalletRuntime|http\/client|\.request\(|fetch\(/,
  );
});

test("pixel CLI requires actual input and matching provenance; L cannot be relabeled W", () => {
  const root = path.resolve(".expo/wallet-qr-batch/cli-fixture");
  mkdirSync(root, { recursive: true });
  const { PNG } = createRequire(import.meta.url)("pngjs") as {
    PNG: {
      sync: {
        write: (data: {
          width: number;
          height: number;
          data: Buffer;
        }) => Buffer;
      };
    };
  };
  const encoded = encodePaymentQr(qrPayloads.ascii);
  if (encoded.kind !== "ready") assert.fail();
  const { pixels, width } = raster(encoded);
  const image = PNG.sync.write({
    width,
    height: width,
    data: Buffer.from(pixels),
  });
  const imagePath = path.join(root, "synthetic.png"),
    provenancePath = path.join(root, "provenance.json");
  writeFileSync(imagePath, image);
  const provenance = {
    layer: "L",
    fixture: "ascii",
    producer: "encoder-raster-fixture",
    imageSha256: createHash("sha256").update(image).digest("hex"),
    sourceRevision: "synthetic-test",
    build: "node-fixture",
    pixelRatio: 1,
  };
  const run = (extra: string[] = []) =>
    spawnSync(
      process.execPath,
      [
        "scripts/wallet-qr-validation.mjs",
        "--image",
        imagePath,
        "--fixture",
        "ascii",
        "--layer",
        "L",
        "--provenance",
        provenancePath,
        ...extra,
      ],
      { encoding: "utf8" },
    );
  writeFileSync(provenancePath, JSON.stringify(provenance));
  const good = run();
  assert.equal(good.status, 0, good.stderr);
  const result = JSON.parse(good.stdout);
  assert.equal(result.pixelDecode, "PASS");
  assert.equal(result.layer, "L");
  assert.equal(result.financialAcceptance, false);
  assert.equal("payload" in result, false);
  for (const bad of [
    { ...provenance, layer: "W" },
    { ...provenance, imageSha256: "0".repeat(64) },
    { ...provenance, producer: "model-equality" },
  ]) {
    writeFileSync(provenancePath, JSON.stringify(bad));
    assert.notEqual(run().status, 0);
  }
  writeFileSync(provenancePath, JSON.stringify(provenance));
  assert.notEqual(run(["--fixture", "not-a-fixture"]).status, 0);
  writeFileSync(imagePath, Buffer.from("not a PNG"));
  assert.notEqual(run().status, 0);
  assert.equal(
    spawnSync(
      process.execPath,
      ["scripts/wallet-qr-validation.mjs", "--help"],
      { encoding: "utf8" },
    ).status,
    0,
  );
  assert.notEqual(
    spawnSync(process.execPath, ["scripts/wallet-qr-validation.mjs"], {
      encoding: "utf8",
    }).status,
    0,
  );
});
