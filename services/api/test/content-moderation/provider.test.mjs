import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigService } from "@nestjs/config";
import sharp from "sharp";
import { OpenAiModerationClient } from "../../dist/modules/content-moderation/infrastructure/openai-moderation.client.js";
import { moderationFlags } from "../../dist/modules/content-moderation/domain/moderation-policy.js";

const settings = new ConfigService({ OPENAI_API_KEY: "fixture-secret" });
const flags = Object.fromEntries(moderationFlags.map((name) => [name, false]));
const scores = Object.fromEntries(moderationFlags.map((name) => [name, 0]));
const input = "Nội dung kiểm thử";

function response(result) {
  return Response.json({
    id: "modr-test",
    model: "omni-moderation-test",
    results: [result],
  });
}

test("sends only the classified input and model to the configured OpenAI endpoint", async (t) => {
  const request = t.mock.method(globalThis, "fetch", async () =>
    response({
      flagged: true,
      categories: { ...flags, violence: true },
      category_scores: { ...scores, violence: 0.2045 },
    }),
  );
  const result = await new OpenAiModerationClient(settings).classify(input);
  assert.equal(result.categories.violence, true);
  assert.equal(result.category_scores.violence, 0.2045);
  assert.equal(result.model, "omni-moderation-test");
  const [url, options] = request.mock.calls[0].arguments;
  assert.equal(url, "https://api.openai.com/v1/moderations");
  assert.equal(options.redirect, "error");
  assert.deepEqual(JSON.parse(options.body), {
    model: "omni-moderation-latest",
    input,
  });
});

test("compresses large visual payloads and uses a separate deadline from text", async (t) => {
  const width = 800;
  const pixels = Buffer.alloc(width * width * 3);
  let seed = 42;
  for (let i = 0; i < pixels.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels[i] = seed >>> 24;
  }
  const png = await sharp(pixels, {
    raw: { width, height: width, channels: 3 },
  })
    .png()
    .toBuffer();
  const contexts = [];
  t.mock.method(AbortSignal, "timeout", (ms) => {
    contexts.push(ms);
    return new AbortController().signal;
  });
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    response({ flagged: false, categories: flags, category_scores: scores }),
  );
  const client = new OpenAiModerationClient(settings);
  await client.classify(input);
  await client.classify({ image: { mimeType: "image/png", bytes: png } });
  assert.deepEqual(contexts, [2000, 6000]);
  const sent = JSON.parse(fetch.mock.calls[1].arguments[1].body).input[0]
    .image_url.url;
  assert.match(sent, /^data:image\/jpeg;base64,/u);
  const jpeg = Buffer.from(sent.split(",")[1], "base64");
  assert.ok(jpeg.length < png.length / 2);
  assert.equal((await sharp(jpeg).metadata()).width, width);
});

test("distinguishes provider deadlines without leaking provider error details", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new DOMException("upstream payload", "TimeoutError");
  });
  await assert.rejects(new OpenAiModerationClient(settings).classify(input), {
    message: "MODERATION_PROVIDER_UNAVAILABLE",
    reasonCode: "PROVIDER_TIMEOUT",
  });
});

test("preserves small PNG payloads and honors the configured visual deadline", async (t) => {
  const bytes = Buffer.from("fixture");
  const timeout = t.mock.method(
    AbortSignal,
    "timeout",
    () => new AbortController().signal,
  );
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    response({ flagged: false, categories: flags, category_scores: scores }),
  );
  await new OpenAiModerationClient(
    new ConfigService({
      OPENAI_API_KEY: "fixture-secret",
      CONTENT_MODERATION_IMAGE_TIMEOUT_MS: 4000,
    }),
  ).classify({ image: { mimeType: "image/png", bytes } });
  assert.equal(timeout.mock.calls[0].arguments[0], 4000);
  const sent = JSON.parse(fetch.mock.calls[0].arguments[1].body).input[0]
    .image_url.url;
  assert.equal(sent, `data:image/png;base64,${bytes.toString("base64")}`);
});

test("rejects missing and out-of-range scores rather than allowing unassessed content", async (t) => {
  for (const category_scores of [
    undefined,
    {},
    { ...scores, violence: 1.01 },
  ]) {
    const request = t.mock.method(globalThis, "fetch", async () =>
      response({
        flagged: true,
        categories: { ...flags, violence: true },
        category_scores,
      }),
    );
    await assert.rejects(new OpenAiModerationClient(settings).classify(input), {
      message: "MODERATION_PROVIDER_UNAVAILABLE",
    });
    request.mock.restore();
  }
});

test("treats HTTP failures, timeout, and malformed results as unavailable", async (t) => {
  for (const status of [429, 500]) {
    const request = t.mock.method(
      globalThis,
      "fetch",
      async () => new Response(input, { status }),
    );
    await assert.rejects(new OpenAiModerationClient(settings).classify(input), {
      message: "MODERATION_PROVIDER_UNAVAILABLE",
    });
    request.mock.restore();
  }
  const request = t.mock.method(globalThis, "fetch", async () => {
    throw new DOMException(input, "TimeoutError");
  });
  await assert.rejects(new OpenAiModerationClient(settings).classify(input), {
    message: "MODERATION_PROVIDER_UNAVAILABLE",
  });
  request.mock.restore();
  t.mock.method(globalThis, "fetch", async () =>
    response({ flagged: false, categories: {} }),
  );
  await assert.rejects(new OpenAiModerationClient(settings).classify(input), {
    message: "MODERATION_PROVIDER_UNAVAILABLE",
  });
});
