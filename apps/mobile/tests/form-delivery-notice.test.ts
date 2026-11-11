import assert from "node:assert/strict";
import test from "node:test";
import { mock } from "node:test";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { formDeliveryNotice } from "../src/features/messages/utils/form-delivery-notice";
import {
  confirmedFormMessage,
  confirmedMethodMessage,
} from "../src/features/learning-paths/utils/confirmed-form";
import { scheduledMessage } from "./fixtures/legacy-schedule-messages";
import type { FormDelivery } from "../src/features/messages/utils/confirmed-form-delivery";
import { fixtureId } from "./fixtures/learning-requests-data";

test("chat delivery notices identify the saved action without confusing confirmation and locking", () => {
  const pathId = fixtureId(30),
    planId = fixtureId(11),
    scheduleId = fixtureId(50);
  const messages = [
    [
      confirmedMethodMessage(pathId, 3, {
        exchangeType: "TWO_WAY",
        totalCreditPerUser: "20",
      }),
      "Cách học đã được xác nhận.",
    ],
    [
      confirmedFormMessage({
        kind: "plan",
        pathId,
        planId,
        version: 2,
        title: "React",
        summary: "1 buổi",
      }),
      "Lộ trình đã được xác nhận.",
    ],
    [
      confirmedFormMessage({
        kind: "schedule",
        pathId,
        planId,
        scheduleId,
        version: 4,
        title: "React",
        summary: "1 buổi",
      }),
      "Lịch học đã được xác nhận.",
    ],
    [
      scheduledMessage({
        pathId,
        version: 3,
        sessions: [
          { startAt: "2030-01-02T10:00:00Z", endAt: "2030-01-02T11:00:00Z" },
        ],
      }),
      "Lịch học đã được chốt.",
    ],
  ];
  for (const [messageText, saved] of messages) {
    const item: FormDelivery = {
      conversationId: fixtureId(40),
      clientMessageId: fixtureId(99),
      messageText: messageText!,
      state: "failed",
    };
    assert.ok(formDeliveryNotice(item).startsWith(saved!));
    assert.match(
      formDeliveryNotice(item),
      /Chưa gửi được thẻ.*không cần thực hiện lại/s,
    );
    assert.match(
      formDeliveryNotice({ ...item, state: "sending" }),
      /Đang gửi thẻ cập nhật/,
    );
    assert.match(
      formDeliveryNotice({ ...item, state: "processing" }),
      /đang được xử lý/,
    );
    assert.doesNotMatch(
      formDeliveryNotice(item),
      /form|gửi thất bại hoàn toàn/,
    );
  }
  assert.match(
    formDeliveryNotice({
      conversationId: pathId,
      clientMessageId: planId,
      messageText: "unexpected text",
      state: "failed",
    }),
    /^Thao tác đã được lưu/,
  );
});

test("pending card feedback only checks or retries chat delivery for the current conversation", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/ConfirmedFormFeedback.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ConfirmedFormFeedback.tsx");
  const conversationId = fixtureId(40);
  const item: FormDelivery = {
    conversationId,
    clientMessageId: fixtureId(99),
    state: "failed",
    messageText: confirmedMethodMessage(fixtureId(30), 3, {
      exchangeType: "TWO_WAY",
      totalCreditPerUser: "20",
    }),
  };
  let checks = 0,
    retries = 0;
  type Element = { type: unknown; props: Record<string, unknown> };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const elements = (value: unknown): Element[] => {
    if (Array.isArray(value)) return value.flatMap(elements);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...elements(element.props.children)];
  };
  const mocks = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { View: "View" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/components/Button": { Button: "Button" },
    "../hooks/use-confirmed-form-share": {
      useConfirmedFormShare: () => ({
        pending: [item, { ...item, conversationId: fixtureId(88) }],
        check: (value: FormDelivery) => {
          assert.equal(value, item);
          checks++;
        },
        retry: (value: FormDelivery) => {
          assert.equal(value, item);
          retries++;
        },
      }),
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ConfirmedFormFeedback } = local(
      filename,
    ) as typeof import("../src/features/messages/components/ConfirmedFormFeedback");
    const render = () => elements(ConfirmedFormFeedback({ conversationId }));
    let tree = render();
    assert.equal(tree.filter((node) => node.type === "Notice").length, 1);
    assert.equal(
      tree.find((node) => node.type === "Notice")!.props.tone,
      "warning",
    );
    for (const label of ["Kiểm tra lần gửi thẻ", "Gửi lại thẻ vào Chat"]) {
      const button = tree.find(
        (node) => node.type === "Button" && node.props.children === label,
      )!;
      (button.props.onPress as () => void)();
    }
    assert.equal(checks, 1);
    assert.equal(retries, 1);
    item.state = "processing";
    tree = render();
    assert.equal(tree.filter((node) => node.type === "Button").length, 1);
    assert.equal(
      tree.find((node) => node.type === "Notice")!.props.tone,
      "info",
    );
    item.state = "sending";
    assert.equal(render().filter((node) => node.type === "Button").length, 0);
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((context) => context.restore());
  }
});
