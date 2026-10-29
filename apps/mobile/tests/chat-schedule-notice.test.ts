import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  scheduledMessage,
  readScheduledMessage,
} from "../src/features/learning-paths/utils/scheduled-message";
import { confirmedFormMessage } from "../src/features/learning-paths/utils/confirmed-form";
import { chatTimeline } from "../src/features/messages/utils/chat-timeline";
import { readChatSchedule } from "../src/features/messages/utils/schedule-notice";
import type { ApiMessage } from "../src/features/messages/api/messages-api";
import { fixtureId } from "./fixtures/learning-requests-data";
import {
  agreementPath,
  withConfirmedSchedules,
} from "./fixtures/learning-agreement";

const pathId = fixtureId(30),
  conversationId = fixtureId(40);
const result = (count = 6) => ({
  pathId,
  version: 3,
  sessions: Array.from({ length: count }, (_, index) => ({
    startAt: new Date(
      Date.parse("2026-10-28T14:00:00Z") + index * 86_400_000,
    ).toISOString(),
    endAt: new Date(
      Date.parse("2026-10-28T15:00:00Z") + index * 86_400_000,
    ).toISOString(),
  })),
});
function message(n: number, messageText: string, sender = 1): ApiMessage {
  return {
    id: fixtureId(100 + n),
    conversationId,
    senderId: fixtureId(sender),
    messageText,
    messageType: "TEXT",
    attachments: [],
    sequence: String(n),
    sentAt: new Date(
      Date.parse("2026-10-27T10:00:00Z") + n * 60_000,
    ).toISOString(),
    readAt: null,
  };
}
function oldSchedule(plan: number, version: number) {
  return confirmedFormMessage({
    kind: "schedule",
    pathId,
    planId: fixtureId(plan),
    scheduleId: fixtureId(plan + 40),
    version,
    title: `Mục tiêu ${plan}`,
    summary: "3 buổi · Bắt đầu 21:00:00, 28/10/2026",
  });
}

test("one scheduled message summarizes all sessions and retains UTC dates through escaped history URLs", () => {
  const value = result();
  value.sessions.reverse();
  const text = scheduledMessage(value);
  const notice = readScheduledMessage(text)!;
  assert.equal(notice.sessionCount, 6);
  assert.equal(notice.startAt, "2026-10-28T14:00:00.000Z");
  assert.equal(notice.endAt, "2026-11-02T15:00:00.000Z");
  assert.equal(
    text.split("skillhub://").length,
    2,
    "one link, not one message per session",
  );
  assert.deepEqual(readScheduledMessage(text.replaceAll("&", "&amp;")), notice);
  for (const invalid of [
    text.replace("sessions=6", "sessions=0"),
    text.replace("6 buổi", "7 buổi"),
    `${text}\nextra`,
    text.replace(pathId, "invalid"),
  ])
    assert.equal(readScheduledMessage(invalid), null);
});

test("historical schedule confirmations from both participants and versions collapse to one card without hiding ordinary chat", () => {
  const messages = [
    message(1, oldSchedule(11, 1)),
    message(2, oldSchedule(12, 2), 2),
    message(3, "Mình học vào buổi tối nhé"),
    message(4, oldSchedule(11, 2)),
    message(5, oldSchedule(12, 2)),
  ];
  const timeline = chatTimeline(messages, []);
  assert.equal(timeline.length, 2);
  const cards = timeline.filter(
    (item) => item.kind === "message" && item.scheduleNotice,
  );
  assert.equal(cards.length, 1);
  assert.ok(cards[0]!.kind === "message");
  assert.equal(
    cards[0]!.message.id,
    messages[4]!.id,
    "read acknowledgement retains the latest sequence",
  );
  assert.equal(
    cards[0]!.scheduleNotice!.locked,
    false,
    "an old confirmation cannot claim finalization",
  );
  assert.equal(
    cards[0]!.scheduleNotice!.sessionCount,
    undefined,
    "partial history cannot establish the path's total session count",
  );
  assert.equal(messages.length, 5, "grouping changes presentation only");
});

test("finalization replaces historical confirmations, stays single on replay and cannot be downgraded by a late old confirmation", () => {
  const before = chatTimeline([message(1, oldSchedule(11, 1))], []);
  const messages = [
    message(1, oldSchedule(11, 1)),
    message(2, scheduledMessage(result())),
    message(3, scheduledMessage(result()), 2),
    message(4, oldSchedule(11, 1)),
  ];
  const after = chatTimeline(messages, []);
  assert.equal(after.length, 1);
  assert.equal(
    after[0]!.id,
    before[0]!.id,
    "card identity remains stable as more history is loaded",
  );
  assert.ok(after[0]!.kind === "message");
  assert.equal(after[0]!.scheduleNotice!.locked, true);
  assert.equal(after[0]!.scheduleNotice!.sessionCount, 6);
  assert.equal(after[0]!.message.sequence, "4");
});

test("different paths, plain text and files are not merged into a schedule notification", () => {
  const first = message(1, scheduledMessage(result(1)));
  const second = message(
    2,
    scheduledMessage({ ...result(1), pathId: fixtureId(31) }),
  );
  const text = message(3, "Lịch học đã chốt nhưng mình muốn hỏi thêm");
  const file = {
    ...message(4, first.messageText),
    messageType: "FILE" as const,
  };
  assert.equal(readChatSchedule(file), null);
  assert.equal(chatTimeline([first, second, text, file], []).length, 4);
});

test("schedule notice card is compact, has no per-session list or confirmation version and opens the full schedule", () => {
  const local = createRequire(
    new URL(
      "../src/features/messages/components/ChatScheduleNotice.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ChatScheduleNotice.tsx");
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const mocks = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "./ChatWorkflowCard": { ChatWorkflowCard: "ChatWorkflowCard" },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  type Element = { type: string; props: Record<string, unknown> };
  const elements = (value: unknown): Element[] => {
    if (Array.isArray(value)) return value.flatMap(elements);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...elements(element.props.children)];
  };
  try {
    delete local.cache[filename];
    const { ChatScheduleNotice } = local(filename);
    let presses = 0;
    const tree = elements(
      ChatScheduleNotice({
        mine: false,
        partner: "Đối tác",
        partnerId: fixtureId(2),
        avatarUrl: "https://example.com/avatar.png",
        showAvatar: true,
        notice: {
          ...readScheduledMessage(scheduledMessage(result()))!,
          locked: true,
        },
        onPress: () => {
          presses++;
        },
      }),
    );
    const action = tree.find((item) => item.type === "ChatWorkflowCard")!;
    assert.equal(action.props.label, "Lịch học");
    assert.equal(action.props.title, "6 buổi học đã sẵn sàng.");
    assert.equal(action.props.confirmed, true);
    assert.equal(action.props.badgeLabel, "Đã chốt");
    assert.equal(action.props.version, undefined);
    assert.equal(action.props.mine, false);
    assert.equal(action.props.partnerId, fixtureId(2));
    assert.equal(action.props.avatarUrl, "https://example.com/avatar.png");
    assert.equal(action.props.showAvatar, true);
    assert.equal(action.props.actionText, "Xem lịch học");
    (action.props.onPress as () => void)();
    assert.equal(presses, 1);
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((item) => item.restore());
  }
});

test("confirming both schedule directions saves confirmations without publishing chat cards", async () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/screens/ApiScheduleScreens.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ApiScheduleScreens.tsx");
  const path = withConfirmedSchedules(agreementPath(true));
  for (const plan of path.plans) {
    plan.schedule!.participantAConfirmedAt = null;
    plan.schedule!.participantBConfirmedAt = null;
  }
  let confirmations = 0,
    shares = 0;
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const mocks = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: { useRef: (current: unknown) => ({ current }) },
    "expo-router": {
      useLocalSearchParams: () => ({ id: path.id }),
      useRouter: () => ({ push() {} }),
    },
    "@/components/feature-page": { Copy: "Copy", RouteButton: "RouteButton" },
    "@/components/learning-flow": { FlowPage: "Page" },
    "@/components/Button": { Button: "Button" },
    "@/components/EmptyState": { EmptyState: "Empty" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/features/connections": {
      useConnections: () => ({
        userId: path.participantAId,
        isCurrent: () => true,
      }),
      useCatalogName: () => ({ data: "React" }),
      useConnectionCommand: () => ({
        run: (_key: string, send: (id: string) => Promise<unknown>) =>
          send(fixtureId(99)),
      }),
      ConnectionFeedback: "Feedback",
    },
    "@/features/messages/state": {
      ConfirmedFormFeedback: "ChatFeedback",
      useConfirmedFormShare: () => ({
        publish: () => {
          shares++;
        },
      }),
    },
    "../hooks/use-learning-paths-api": {
      useLearningPath: () => ({ data: path, refetch() {} }),
      useLearningPathsApi: () => ({
        confirmSchedule: async () => {
          confirmations++;
          return { version: 4 };
        },
      }),
    },
    "../hooks/use-pull-refresh": { usePullRefresh: () => ({}) },
    "../components/PathReadFeedback": { PathReadFeedback: "ReadFeedback" },
    "../components/schedule-editor-form": { ScheduleForm: "Form" },
    "./ApiHoldScreen": { ApiFinalizePanel: "Finalize" },
    "../components/schedule-read-card": {
      ScheduleListOverview: "Overview",
      ScheduleReadCard: "Card",
      ScheduleExchangeContext: "Context",
      ScheduleMissingPlanCard: "Missing",
      ScheduleTimezoneNotice: "Timezone",
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  type Element = {
    type: string | ((props: Record<string, unknown>) => unknown);
    props: Record<string, unknown>;
  };
  const elements = (value: unknown): Element[] => {
    if (Array.isArray(value)) return value.flatMap(elements);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...elements(element.props.children)];
  };
  try {
    delete local.cache[filename];
    const { ApiSchedulesScreen } = local(filename);
    const panels = elements(ApiSchedulesScreen()).filter(
      (item) =>
        typeof item.type === "function" && item.type.name === "SchedulePanel",
    );
    assert.equal(panels.length, 2);
    for (const panel of panels) {
      const tree = elements(
        (panel.type as (props: Record<string, unknown>) => unknown)(
          panel.props,
        ),
      );
      const confirm = tree.find(
        (item) =>
          item.type === "Button" && item.props.children === "Đồng ý lịch học",
      )!;
      (confirm.props.onPress as () => void)();
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(confirmations, 2);
    assert.equal(shares, 0);
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((item) => item.restore());
  }
});
