import assert from "node:assert/strict";
import { test } from "node:test";
import { detectContactInformation } from "../src/lib/chat/contact-policy";

test("contact categories preserve normalization, obfuscation and detection priority", () => {
  const examples = {
    email: [
      "loan@example.com",
      "loan [at] gmail [dot] com",
      "loan @ gmail . com",
      "0912345678 loan@example.com",
    ],
    phone: [
      "０９１２３４５６７８",
      "09\u200b12 345 678",
      "+84 (912) 345-678",
      "+1 415 555 2671",
      "2. 0912345678",
      "84 912345678",
      "Số tài khoản: 0912345678",
    ],
    social: [
      "https://www.facebook.com/my.profile",
      "m.facebook.com/person",
      "https://linkedin.com/in/person",
      "https://tiktok.com/@person",
      "https://discord.com/invite/room",
      "Telegram: @myhandle",
      "zalo của mình là loan123",
      "skype id user123",
      "zalo @--a",
    ],
    identity: [
      "CCCD: 012345678901",
      "Số tài khoản: 123456789012",
      "passport của tôi: AB 123456",
      "stk 1.2.3.4.5.6",
    ],
    address: [
      "Địa chỉ nhà: 12 Nguyễn Huệ",
      "nhà tôi ở: 12A/2 Nguyễn Huệ",
      "địa chỉ riêng: 12 一 二",
      "địa chỉ nhà tôi ở: 12 Nguyễn Huệ",
    ],
  };
  for (const [kind, texts] of Object.entries(examples))
    for (const text of texts)
      assert.equal(detectContactInformation(text), kind, text);
});

test("ordinary content, incomplete contacts and embedded identifiers remain allowed", () => {
  for (const text of [
    "Học lúc 09:00 ngày 18/11/2026 nhé",
    "Phí 20.00 CR, nạp 100.000 VND",
    "Tổng 1234567890",
    "11111111-1111-4111-8111-111111111111",
    "a0912345678",
    "0912345678a",
    "0912345678901234",
    "0 912345678",
    "a+14155552671",
    "Học Facebook marketing nhé",
    "Telegram: @ab",
    "https://facebook.com/",
    "https://www.typescriptlang.org/docs/",
    "https://notfacebook.com/facebook.com/name",
    "https://example.org/docs/facebook.com/person",
    "a@b",
    "a@b..com",
    "CCCD: 12345",
    "passport: ABC 123456",
    "Địa chỉ nhà: 12 Nguyễn",
  ])
    assert.equal(detectContactInformation(text), null, text);
});

test("long unsuccessful matches complete without truncating contact detection", () => {
  const long = " ".repeat(100_000);
  for (const text of [
    "a".repeat(100_000),
    "a@" + "b".repeat(100_000),
    "a.".repeat(50_000),
    "0" + "-".repeat(100_000) + "x",
    "zalo:" + long,
    "CCCD:" + long + "A",
    "Địa chỉ nhà: 12" + long + "Nguyễn",
  ])
    assert.equal(detectContactInformation(text), null);
  assert.equal(detectContactInformation(long + "loan@example.com"), "email");
  assert.equal(detectContactInformation("0" + long + "912345678"), null);
  assert.equal(detectContactInformation("09" + long + "12345678"), "phone");
  assert.equal(detectContactInformation("zalo:" + long + "myhandle"), "social");
  assert.equal(
    detectContactInformation("CCCD:" + long + "123456789012"),
    "identity",
  );
  assert.equal(
    detectContactInformation("Địa chỉ nhà: 12" + long + "Nguyễn Huệ"),
    "address",
  );
});
