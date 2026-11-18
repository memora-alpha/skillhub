import assert from "node:assert/strict";
import test from "node:test";
import { systemMessageText } from "../src/features/messages/utils/system-message-text";

test("schedule notes keep participants, teaching direction and the remaining step", () => {
  const prefix = "An đã xác nhận lịch An dạy Bình";
  for (const [status, expected] of [
    ["Đang chờ Bình xác nhận.", "Chờ Bình xác nhận."],
    [
      "Hai bên đã xác nhận lịch này. Chờ chốt thỏa thuận.",
      "Đủ xác nhận, chờ chốt.",
    ],
  ]) {
    assert.equal(
      systemMessageText({
        messageType: "SYSTEM",
        objectType: "SCHEDULE_PROPOSAL",
        messageText: `${prefix}. ${status}`,
      }),
      `${prefix} · ${expected}`,
    );
  }
});

test("reschedule notes distinguish waiting with the old schedule from an applied new schedule", () => {
  const prefix = "Bình đã đồng ý đổi lịch An dạy Bình";
  for (const [status, expected] of [
    [
      "Đang chờ An xác nhận đổi lịch. Lịch hiện tại vẫn giữ nguyên.",
      "Chờ An đồng ý đổi lịch; giữ lịch cũ.",
    ],
    [
      "Hai bên đã xác nhận đổi lịch. Lịch mới đã được áp dụng.",
      "Hai bên đã đồng ý, lịch mới đã áp dụng.",
    ],
  ]) {
    assert.equal(
      systemMessageText({
        messageType: "SYSTEM",
        objectType: "SCHEDULE_PROPOSAL",
        messageText: `${prefix}. ${status}`,
      }),
      `${prefix} · ${expected}`,
    );
  }
});

test("finalization notes keep the session count and unknown or participant text stays verbatim", () => {
  const messageText =
    "Thỏa thuận đã được chốt. Lịch học đã được khóa và 12 buổi học đã được tạo. Xem lịch học.";
  assert.equal(
    systemMessageText({
      messageType: "SYSTEM",
      objectType: "LEARNING_PATH",
      messageText,
    }),
    "Đã chốt lịch · 12 buổi học.",
  );
  assert.equal(
    systemMessageText({
      messageType: "TEXT",
      objectType: "LEARNING_PATH",
      messageText,
    }),
    messageText,
  );
  assert.equal(
    systemMessageText({ messageType: "SYSTEM", messageText }),
    messageText,
  );
  const unknown = "Lịch học cần xem lại. Giữ nguyên ghi chú mới từ hệ thống.";
  assert.equal(
    systemMessageText({
      messageType: "SYSTEM",
      objectType: "SCHEDULE_PROPOSAL",
      messageText: unknown,
    }),
    unknown,
  );
});
