import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigService } from "@nestjs/config";
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
