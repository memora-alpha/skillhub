import assert from "node:assert/strict";
import test from "node:test";
import {
  readScheduleConfirmation,
  type ScheduleConfirmation,
} from "../src/features/learning-paths/utils/schedule-confirmation-message";
import { readConfirmedForm } from "../src/features/learning-paths/utils/confirmed-form";
import {
  scheduledMessage,
  scheduleConfirmationMessage,
} from "./fixtures/legacy-schedule-messages";
import { readChatSchedule } from "../src/features/messages/utils/schedule-notice";
import { chatTimeline } from "../src/features/messages/utils/chat-timeline";
import { conversationInbox } from "../src/features/messages/utils/conversation-preview";
import { hasUnreadIncoming } from "../src/features/messages/utils/inbox-unread";
import { confirmAndShare } from "../src/features/learning-paths/api/confirm-and-share";
import {
  createFormDelivery,
  type FormDelivery,
} from "../src/features/messages/utils/confirmed-form-delivery";
import type { ApiMessage } from "../src/features/messages/api/messages-api";
import { fixtureId } from "./fixtures/learning-requests-data";

const receipt = (
  overrides: Partial<ScheduleConfirmation> = {},
): ScheduleConfirmation => ({
  pathId: fixtureId(30),
  planId: fixtureId(11),
  scheduleId: fixtureId(50),
  version: 4,
  teacherId: fixtureId(1),
  learnerId: fixtureId(2),
  confirmedBy: fixtureId(1),
  bothConfirmed: false,
  title: "React & TypeScript",
  ...overrides,
});
const message = (index: number, value = receipt()): ApiMessage => ({
  id: fixtureId(100 + index),
  conversationId: fixtureId(40),
  senderId: value.confirmedBy,
  messageType: "TEXT",
  attachments: [],
  messageText: scheduleConfirmationMessage(value),
  sequence: String(index),
  sentAt: `2030-01-0${index}T12:00:00Z`,
  readAt: null,
});

test("schedule confirmation records the exact direction, actor, version and server bothConfirmed receipt", () => {
  for (const confirmedBy of [fixtureId(1), fixtureId(2)])
    for (const bothConfirmed of [false, true]) {
      const input = receipt({ confirmedBy, bothConfirmed });
      const text = scheduleConfirmationMessage(input);
      assert.deepEqual(readScheduleConfirmation(text), input);
      const urlStart = text.lastIndexOf("skillhub://");
      const escaped =
        text.slice(0, urlStart) + text.slice(urlStart).replaceAll("&", "&amp;");
      assert.deepEqual(readScheduleConfirmation(escaped), input);
      assert.equal(
        readConfirmedForm(text)?.kind,
        "schedule",
        "legacy clients can still read the form",
      );
      assert.equal(
        readChatSchedule({ ...message(1, input), messageText: text })
          ?.confirmation?.bothConfirmed,
        bothConfirmed,
      );
      assert.match(
        text,
        bothConfirmed ? /Chưa chốt lịch/ : /Chờ (người học|người dạy) xác nhận/,
      );
    }
});

test("invalid confirmation metadata and a mismatched sender cannot become a specific receipt", () => {
  const text = scheduleConfirmationMessage(receipt());
  for (const invalid of [
    text.replace("bothConfirmed=false", "bothConfirmed=maybe"),
    text.replace(`confirmedBy=${fixtureId(1)}`, `confirmedBy=${fixtureId(9)}`),
    text.replace(`teacherId=${fixtureId(1)}`, `teacherId=${fixtureId(2)}`),
    text.replace("version=4", "version=5"),
    `${text}\nextra`,
  ])
    assert.equal(readScheduleConfirmation(invalid), null);
  assert.equal(
    readChatSchedule({ ...message(1), senderId: fixtureId(9) }),
    null,
  );
  assert.equal(readChatSchedule({ ...message(1), messageType: "FILE" }), null);
});

test("chat keeps confirmations from both participants and directions separate from finalization", () => {
  const messages = [
    message(1),
    message(2, receipt({ confirmedBy: fixtureId(2), bothConfirmed: true })),
    message(
      3,
      receipt({
        planId: fixtureId(12),
        scheduleId: fixtureId(51),
        teacherId: fixtureId(2),
        learnerId: fixtureId(1),
      }),
    ),
    {
      ...message(4),
      messageText: scheduledMessage({
        pathId: fixtureId(30),
        version: 3,
        sessions: [
          { startAt: "2030-01-02T10:00:00Z", endAt: "2030-01-02T11:00:00Z" },
        ],
      }),
    },
  ];
  const timeline = chatTimeline(messages, []);
  assert.equal(timeline.length, 4);
  assert.equal(new Set(timeline.map((item) => item.id)).size, 4);
  const notices = timeline.flatMap((item) =>
    item.kind === "message" ? [item.scheduleNotice!] : [],
  );
  assert.deepEqual(
    notices.map((notice) => notice.locked),
    [false, false, false, true],
  );
  assert.equal(notices[1]!.confirmation!.bothConfirmed, true);
  assert.equal(notices[2]!.confirmation!.planId, fixtureId(12));
});

test("delivered confirmation previews reorder the inbox and retain only genuine incoming unread state", () => {
  const rows = [40, 41].map((id) => ({
    id: fixtureId(id),
    proposalId: fixtureId(id + 10),
    learningRequestId: null,
    participantAId: fixtureId(1),
    participantBId: fixtureId(2),
    createdAt: "2029-12-01T00:00:00Z",
    lastActivityAt: id === 41 ? "2029-12-20T00:00:00Z" : "2029-12-10T00:00:00Z",
  }));
  for (const bothConfirmed of [false, true]) {
    const item = message(1, receipt({ bothConfirmed }));
    const inbox = conversationInbox(
      rows,
      new Map([[item.conversationId, item]]),
      [],
      fixtureId(2),
    );
    assert.equal(inbox[0]!.conversation.id, fixtureId(40));
    assert.equal(hasUnreadIncoming([item], fixtureId(2)), true);
    assert.equal(
      inbox[0]!.preview,
      bothConfirmed
        ? "Hai bên đã đồng ý lịch học · Chưa chốt"
        : "Đã đồng ý lịch học · Chờ người còn lại",
    );
    assert.equal(hasUnreadIncoming([item], fixtureId(1)), false);
    assert.equal(
      hasUnreadIncoming([{ ...item, readAt: item.sentAt }], fixtureId(2)),
      false,
    );
  }
});

test("a failed schedule card can be retried with the same body and identity without confirming again", async () => {
  let items: FormDelivery[] = [],
    confirmations = 0,
    sendingFails = true,
    refreshes = 0;
  const sends: { clientMessageId: string; messageText: string }[] = [];
  const queue = createFormDelivery({
    api: {
      send: async (_id, body) => {
        sends.push({
          clientMessageId: body.clientMessageId,
          messageText: body.messageText!,
        });
        if (sendingFails) throw new Error("Offline");
        return {
          deliveryStatus: "DELIVERED",
          message: { ...message(1), messageText: body.messageText! },
        };
      },
      delivery: async () => {
        throw new Error("Unexpected status check");
      },
    },
    isCurrent: () => true,
    read: () => items,
    write: (value) => {
      items = value;
    },
    refresh: () => {
      refreshes++;
    },
  });
  const run = confirmAndShare(
    async () => {
      confirmations++;
      return { bothConfirmed: false };
    },
    (result, identity) => {
      void queue.publish(
        fixtureId(40),
        scheduleConfirmationMessage(receipt(result)),
        identity,
      );
    },
    () => true,
  );
  await run(fixtureId(90));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(confirmations, 1);
  assert.equal(items[0]!.state, "failed");
  sendingFails = false;
  await queue.retry(items[0]!);
  assert.equal(confirmations, 1);
  assert.equal(sends.length, 2);
  assert.deepEqual(sends[0], sends[1]);
  assert.equal(
    readScheduleConfirmation(sends[1]!.messageText)?.bothConfirmed,
    false,
  );
  assert.deepEqual(items, []);
  assert.equal(refreshes, 1);
});
