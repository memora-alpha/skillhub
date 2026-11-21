import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultProfanityRules,
  matchProfanity,
} from "../../dist/modules/content-moderation/domain/profanity-policy.js";

const banned = [
  "địt mẹ",
  "đụ má",
  "đù má",
  "đéo",
  "vãi lồn",
  "mày ngu",
  "đồ ngu",
  "ngu như chó",
  "câm mõm",
  "ngu",
  "đù",
  "vãi",
  "vcl",
  "vl",
  "du ma",
  "dit me",
  "đ.m",
  "đ*t mẹ",
];

test("blocks each seed and handles Vietnamese boundaries and normalization", () => {
  for (const text of [
    ...banned,
    "ĐÙ MÁ!",
    "đù má".normalize("NFD"),
    "đụ...má",
    "đé\u200Bo",
    "Thôi, câm  mõm đi",
    "VL",
  ])
    assert.ok(matchProfanity(text, defaultProfanityRules), text);
  for (const text of [
    "ngủ",
    "ngũ",
    "đụng",
    "vải",
    "đậu",
    "AVLT",
    "đxm",
    "đxt mẹ",
  ])
    assert.equal(matchProfanity(text, defaultProfanityRules), null, text);
});

test("honors explicit aliases and disabled rules without stripping accents", () => {
  const rule = {
    id: "test",
    term: "cá tím",
    aliases: ["ca tim"],
    enabled: true,
  };
  assert.deepEqual(matchProfanity("đây là CA TIM!", [rule]), {
    ruleId: "test",
  });
  assert.equal(matchProfanity("cà tím", [rule]), null);
  assert.equal(matchProfanity("cá tím", [{ ...rule, enabled: false }]), null);
});
