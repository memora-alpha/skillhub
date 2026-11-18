import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConversationsService } from "../../dist/modules/conversations/application/services/conversations.service.js";

const principal = { userId: "sender", sessionId: "session" };
const context = { requestId: "request", correlationId: "correlation" };

function fixture() {
  const effects = [];
  const service = new ConversationsService(
    {},
    {
      run: async () => {
        effects.push("transaction");
        throw new Error("TRANSACTION_REACHED");
      },
    },
    {},
    {},
    {},
    {
      ready: async () => {
        effects.push("chat.ready");
        throw new Error("CHAT_READY_REACHED");
      },
    },
  );
  return { service, effects };
}

test("chat rejects email, phone and contact links before storage readiness or any transaction", async () => {
  for (const messageText of [
    "Email mình: learner+web@example.com",
    "<b>teacher&#64;example.com</b>",
    "learner＠example．com",
    "user@exam\u200bple.com",
    "Gọi 0901234567",
    "SĐT 090 123 4567",
    "SĐT (090) 123-4567",
    "Số bàn 024 1234 5678",
    "Liên hệ +84 90 123 4567",
    "Phone +1 (415) 555-2671",
    "mailto:teacher@example.com",
    "tel:0901234567",
    "sms:+84901234567",
    "https://zalo.me/0901234567",
    "https://wa.me/84901234567",
    "https://api.whatsapp.com/send?phone=84901234567",
    "t.me/skillhub_teacher",
    "https://telegram.me/teacher",
    "https://m.me/teacher",
    "https://www.facebook.com/teacher",
    "https://m.facebook.com/teacher",
    "https://facebook.com/profile.php?id=123",
    "https://instagram.com/teacher",
    "https://www.linkedin.com/in/teacher",
    "https://discord.gg/study",
    "https://discord.com/users/123456789012345678",
    "https://line.me/ti/p/teacher",
    "tg://resolve?domain=teacher",
  ]) {
    const { service, effects } = fixture();
    await assert.rejects(
      service.send(
        principal,
        "conversation",
        { clientMessageId: "client", messageText, attachmentFileIds: ["file"] },
        context,
      ),
      (error) =>
        error.getStatus?.() === 400 &&
        error.message === "CONTACT_INFORMATION_NOT_ALLOWED",
      messageText,
    );
    assert.deepEqual(effects, [], messageText);
  }
});

test("ordinary learning links, schedules, quantities and attachment-only chat remain valid", async () => {
  for (const input of [
    {
      messageText:
        "Mình học lúc 09:00 ngày 18/11/2026, buổi 2 kéo dài 90 phút.",
    },
    {
      messageText:
        "Đọc https://developer.mozilla.org/en-US/docs/Web/JavaScript nhé.",
    },
    {
      messageText:
        "Ví dụ tại https://example.com/t.me/teacher và https://notfacebook.com/teacher",
    },
    {
      messageText:
        "Đọc https://facebook.com/help và https://instagram.com/p/lesson",
    },
    {
      messageText: "Bài tập 1234567890, kết quả 1.234.567, học phí 200 Credit.",
    },
    { messageText: "<b>Hẹn bạn buổi học tiếp theo</b>" },
    { attachmentFileIds: ["file"] },
  ]) {
    const { service, effects } = fixture();
    await assert.rejects(
      service.send(
        principal,
        "conversation",
        { clientMessageId: "client", ...input },
        context,
      ),
      /CHAT_READY_REACHED/,
    );
    assert.deepEqual(effects, ["chat.ready"]);
  }
});
