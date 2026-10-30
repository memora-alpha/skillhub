import assert from "node:assert/strict";
import { test } from "node:test";
import { GeminiVerificationAdapter } from "../../dist/modules/verifications/infrastructure/gateway/gemini-verification.adapter.js";
import { aiConfig, aiSnapshot, aiFileResult } from "./fixtures.mjs";

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function setup(mimeType = "image/png", generation) {
  const snapshot = aiSnapshot();
  snapshot.files[0].mimeType = mimeType;
  const calls = [];
  const transport = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, options, body });
    if (url.endsWith(":countTokens")) return json({ totalTokens: 2400 });
    if (generation) return generation();
    return json({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [{ text: JSON.stringify(aiFileResult(snapshot.files[0])) }],
          },
        },
      ],
      usageMetadata: { promptTokenCount: 2400, totalTokenCount: 4000 },
    });
  };
  return {
    snapshot,
    calls,
    transport,
    input: {
      snapshot,
      file: snapshot.files[0],
      bytes: Buffer.from("dummy"),
      currentDate: "2026-10-23",
    },
  };
}

test("image/PDF requests use fixed provider, header key, structured JSON and no tools/private storage metadata", async () => {
  for (const mime of ["image/png", "application/pdf"]) {
    const f = setup(mime);
    const adapter = new GeminiVerificationAdapter(aiConfig, f.transport);
    const response = await adapter.analyze(f.input);
    assert.equal(response.result.recommendation, "SUPPORTS_SKILL");
    assert.equal(response.usage.outputTokens, 1600);
    assert.equal(f.calls.length, 2);
    const call = f.calls[1];
    assert.equal(
      call.url,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    assert.equal(call.options.headers["x-goog-api-key"], aiConfig.apiKey);
    assert.equal(call.options.redirect, "error");
    assert.equal(call.body.contents[0].parts[1].inlineData.mimeType, mime);
    assert.equal(call.body.tools, undefined);
    assert.ok(
      call.body.generationConfig.responseJsonSchema.properties.dateSources,
    );
    const modelSchema = JSON.stringify(
      call.body.generationConfig.responseJsonSchema,
    );
    assert.ok(
      !modelSchema.includes('"maxItems"') && !modelSchema.includes('"pattern"'),
    );
    assert.ok(!call.options.body.includes(f.input.file.storedFileId));
    assert.ok(!call.options.body.includes(f.input.file.checksum));
    assert.match(
      call.body.systemInstruction.parts[0].text,
      /Không tính từ ngày thi/,
    );
  }
});

test("input token budget rejects oversized PDFs before generation", async () => {
  const f = setup("application/pdf");
  let calls = 0;
  const adapter = new GeminiVerificationAdapter(aiConfig, async () => {
    calls++;
    return json({ totalTokens: 100000 });
  });
  await assert.rejects(
    adapter.analyze(f.input),
    (error) => error.code === "AI_INPUT_TOKEN_LIMIT" && !error.retryable,
  );
  assert.equal(calls, 1);
});

test("provider failures, truncation, invalid JSON and forged authenticity are sanitized and classified", async () => {
  for (const [status, retryable] of [
    [401, false],
    [403, false],
    [400, false],
    [429, true],
    [503, true],
  ]) {
    const f = setup();
    const adapter = new GeminiVerificationAdapter(
      aiConfig,
      async () => new Response(`secret ${aiConfig.apiKey}`, { status }),
    );
    await assert.rejects(
      adapter.analyze(f.input),
      (error) =>
        error.retryable === retryable &&
        !error.message.includes(aiConfig.apiKey),
    );
  }
  const f = setup();
  for (const response of [
    {
      candidates: [
        { finishReason: "MAX_TOKENS", content: { parts: [{ text: "{}" }] } },
      ],
    },
    {
      candidates: [
        { finishReason: "STOP", content: { parts: [{ text: "invalid" }] } },
      ],
    },
    {
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              {
                text: JSON.stringify(
                  aiFileResult(f.input.file, {
                    issuerVerification: "VERIFIED_AT_SOURCE",
                  }),
                ),
              },
            ],
          },
        },
      ],
    },
  ]) {
    const adapter = new GeminiVerificationAdapter(aiConfig, async (url) =>
      url.endsWith(":countTokens")
        ? json({ totalTokens: 100 })
        : json(response),
    );
    await assert.rejects(
      adapter.analyze(f.input),
      (error) => error.retryable && error.message.startsWith("AI_"),
    );
  }
});
