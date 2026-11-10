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
  scheduleConfirmationMessage,
  readScheduleConfirmation,
} from "../src/features/learning-paths/utils/schedule-confirmation-message";
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
    for (const mine of [true, false])
      for (const teacher of [true, false])
        for (const bothConfirmed of [false, true]) {
          const confirmation = readScheduleConfirmation(
            scheduleConfirmationMessage({
              pathId,
              planId: fixtureId(11),
              scheduleId: fixtureId(50),
              version: 4,
              confirmedBy: fixtureId(teacher ? 1 : 2),
              teacherId: fixtureId(1),
              learnerId: fixtureId(2),
              bothConfirmed,
              title: "React cơ bản",
            }),
          )!;
          const [card] = elements(
            ChatScheduleNotice({
              mine,
              partner: "Bình",
              partnerId: fixtureId(2),
              notice: { pathId, locked: false, confirmation },
              onPress() {},
            }),
          );
          assert.equal(
            card!.props.label,
            (mine ? teacher : !teacher) ? "Lịch bạn dạy" : "Lịch bạn học",
          );
          assert.equal(
            card!.props.badgeLabel,
            bothConfirmed ? "Đủ xác nhận" : "Chờ xác nhận",
          );
          assert.equal(card!.props.confirmed, bothConfirmed);
          assert.match(
            String(card!.props.summary),
            bothConfirmed
              ? /Hai bên.*Chưa chốt/
              : mine
                ? /Bạn đã đồng ý.*đối tác/
                : /Bình đã đồng ý.*bạn xác nhận/,
          );
        }
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((item) => item.restore());
  }
});

test("confirming each schedule direction shares its exact receipt only after success", async () => {
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
  let current = true,
    reject = false,
    bothConfirmed = false;
  let uncertain = false,
    retries = 0,
    refreshes = 0;
  let status = "PROPOSED";
  const receipts: { conversationId: string; text: string; identity: string }[] =
    [];
  const query = {
    data: path,
    isFetching: false,
    error: undefined as unknown,
    refetch() {
      refreshes++;
    },
  };
  const jsx = (
    type: unknown,
    props: Record<string, unknown>,
    key?: string,
  ) => ({
    type,
    props,
    key,
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
        isCurrent: () => current,
      }),
      useCatalogName: () => ({ data: "React" }),
      useConnectionCommand: () => ({
        pending: false,
        uncertain,
        retry: async () => {
          retries++;
        },
        run: (_key: string, send: (id: string) => Promise<unknown>) =>
          send(fixtureId(99)).catch(() => undefined),
      }),
      ConnectionFeedback: "Feedback",
    },
    "@/features/messages/state": {
      ConfirmedFormFeedback: "ChatFeedback",
      useConfirmedFormShare: () => ({
        publish: (conversationId: string, text: string, identity: string) => {
          shares++;
          receipts.push({ conversationId, text, identity });
        },
      }),
    },
    "../hooks/use-learning-paths-api": {
      useLearningPath: () => query,
      useLearningPathsApi: () => ({
        confirmSchedule: async () => {
          confirmations++;
          if (reject) throw new Error("Rejected confirmation");
          return { version: 4, bothConfirmed, status };
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
    key?: string;
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
    const page = ApiSchedulesScreen();
    assert.equal(page.props.title, "Lịch học");
    const layout = elements(page);
    assert.ok(
      layout.findIndex((item) => item.type === "Overview") <
        layout.findIndex((item) => item.type === "Context"),
    );
    assert.ok(
      layout.findIndex((item) => item.type === "Context") <
        layout.findIndex((item) => item.type === "Timezone"),
    );
    const panels = layout.filter(
      (item) =>
        typeof item.type === "function" && item.type.name === "SchedulePanel",
    );
    assert.equal(panels.length, 2);
    const originalKey = panels[0]!.key;
    query.data = {
      ...path,
      plans: path.plans.map((plan, index) =>
        index ? plan : { ...plan, schedule: { ...plan.schedule!, version: 5 } },
      ),
    };
    const revisedPanel = elements(ApiSchedulesScreen()).find(
      (item) =>
        typeof item.type === "function" && item.type.name === "SchedulePanel",
    )!;
    assert.notEqual(
      revisedPanel.key,
      originalKey,
      "a new schedule version must not inherit the old command recovery",
    );
    query.data = path;
    for (const refreshing of [true, false]) {
      query.isFetching = refreshing;
      query.error = refreshing ? undefined : new Error("read failed");
      for (const panel of elements(ApiSchedulesScreen()).filter(
        (item) =>
          typeof item.type === "function" && item.type.name === "SchedulePanel",
      )) {
        assert.equal(panel.props.blocked, true);
        const tree = elements(
          (panel.type as (props: Record<string, unknown>) => unknown)(
            panel.props,
          ),
        );
        const confirm = tree.find(
          (item) =>
            item.type === "Button" && item.props.children === "Đồng ý lịch học",
        )!;
        assert.equal(confirm.props.disabled, true);
        (confirm.props.onPress as () => void)();
      }
    }
    assert.equal(confirmations, 0);
    query.isFetching = false;
    query.error = undefined;
    uncertain = true;
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
      assert.equal(confirm.props.disabled, true);
      (confirm.props.onPress as () => void)();
      assert.ok(
        tree.some(
          (item) => item.type === "Notice" && item.props.tone === "warning",
        ),
      );
      assert.equal(
        tree.some((item) => item.type === "Feedback"),
        false,
      );
      const refresh = tree.find(
        (item) => item.props.children === "Kiểm tra trạng thái lịch",
      )!;
      (refresh.props.onPress as () => void)();
      const retry = tree.find(
        (item) => item.props.children === "Kiểm tra lại lần xác nhận trước",
      )!;
      (retry.props.onPress as () => void)();
    }
    assert.equal(confirmations, 0);
    assert.equal(refreshes, 2);
    assert.equal(retries, 2);
    const readPath = structuredClone(path);
    readPath.plans[0]!.schedule!.participantAConfirmedAt =
      "2030-01-01T00:00:00Z";
    const firstReadPanel = panels[0]!;
    const afterRead = elements(
      (firstReadPanel.type as (props: Record<string, unknown>) => unknown)({
        ...firstReadPanel.props,
        path: readPath,
        plan: readPath.plans[0],
      }),
    );
    assert.equal(
      afterRead.some(
        (node) =>
          node.type === "Button" && node.props.children === "Đồng ý lịch học",
      ),
      false,
    );
    assert.equal(
      afterRead.some(
        (node) => node.type === "Notice" && node.props.tone === "warning",
      ),
      false,
    );
    assert.ok(
      afterRead.some(
        (node) => node.type === "Notice" && node.props.tone === "info",
      ),
    );
    assert.equal(
      confirmations,
      0,
      "reading a saved confirmation cannot replay a command",
    );
    assert.match(
      String(afterRead.find((node) => node.type === "Notice")!.props.children),
      /Bạn đã đồng ý lịch này/,
    );
    assert.equal(
      shares,
      0,
      "reading confirmation is not a chat delivery receipt",
    );
    const finishChat = afterRead.find(
      (node) =>
        node.type === "Button" &&
        node.props.children === "Gửi cập nhật vào Chat",
    )!;
    assert.ok(finishChat);
    (finishChat.props.onPress as () => void)();
    assert.equal(retries, 3);
    const editAfterRead = afterRead.find(
      (node) =>
        node.type === "Button" &&
        node.props.children === "Chỉnh sửa lịch tôi dạy",
    )!;
    assert.ok(editAfterRead);
    assert.equal(editAfterRead.props.disabled, false);
    for (const readState of [
      { blocked: true, current: true },
      { blocked: false, current: false },
    ]) {
      current = readState.current;
      const blockedRead = elements(
        (firstReadPanel.type as (props: Record<string, unknown>) => unknown)({
          ...firstReadPanel.props,
          path: readPath,
          plan: readPath.plans[0],
          blocked: readState.blocked,
        }),
      );
      const notice = blockedRead.find((node) => node.type === "Notice")!;
      assert.equal(notice.props.tone, readState.current ? "info" : "warning");
      const chatAction = blockedRead.find(
        (node) => node.props.children === "Gửi cập nhật vào Chat",
      );
      if (readState.current) assert.equal(chatAction?.props.disabled, true);
      else assert.equal(chatAction, undefined);
    }
    current = true;
    const partnerOnly = structuredClone(path);
    partnerOnly.plans[0]!.schedule!.participantBConfirmedAt =
      "2030-01-01T00:00:00Z";
    const partnerRead = elements(
      (firstReadPanel.type as (props: Record<string, unknown>) => unknown)({
        ...firstReadPanel.props,
        path: partnerOnly,
        plan: partnerOnly.plans[0],
      }),
    );
    assert.ok(
      partnerRead.some(
        (node) => node.type === "Notice" && node.props.tone === "warning",
      ),
    );
    const lockedPath = structuredClone(readPath);
    lockedPath.lockedVersion = lockedPath.currentVersion;
    lockedPath.plans[0]!.schedule!.status = "LOCKED";
    const lockedRead = elements(
      (firstReadPanel.type as (props: Record<string, unknown>) => unknown)({
        ...firstReadPanel.props,
        path: lockedPath,
        plan: lockedPath.plans[0],
      }),
    );
    assert.equal(
      lockedRead.some((node) => node.type === "Notice"),
      false,
    );
    assert.equal(
      lockedRead.some(
        (node) => node.props.children === "Gửi cập nhật vào Chat",
      ),
      false,
    );
    uncertain = false;
    for (const panel of panels) {
      bothConfirmed = panel.props.plan === path.plans[1];
      const tree = elements(
        (panel.type as (props: Record<string, unknown>) => unknown)(
          panel.props,
        ),
      );
      const confirm = tree.find(
        (item) =>
          item.type === "Button" && item.props.children === "Đồng ý lịch học",
      )!;
      assert.equal(confirm.props.disabled, false);
      (confirm.props.onPress as () => void)();
      await new Promise((resolve) => setImmediate(resolve));
    }
    assert.equal(confirmations, 2);
    assert.equal(shares, 2);
    for (const [index, receipt] of receipts.entries()) {
      const parsed = readScheduleConfirmation(receipt.text)!;
      assert.equal(receipt.conversationId, path.conversationId);
      assert.equal(receipt.identity, fixtureId(99));
      assert.equal(parsed.planId, path.plans[index]!.id);
      assert.equal(parsed.scheduleId, path.plans[index]!.schedule!.id);
      assert.equal(parsed.version, 4);
      assert.equal(parsed.confirmedBy, path.participantAId);
      assert.equal(parsed.bothConfirmed, index === 1);
    }
    const firstPanel = panels[0]!;
    const confirmAgain = () =>
      elements(
        (firstPanel.type as (props: Record<string, unknown>) => unknown)(
          firstPanel.props,
        ),
      ).find(
        (item) =>
          item.type === "Button" && item.props.children === "Đồng ý lịch học",
      )!.props.onPress as () => void;
    reject = true;
    confirmAgain()();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(confirmations, 3);
    assert.equal(shares, 2, "a failed confirmation does not announce success");
    reject = false;
    status = "LOCKED";
    confirmAgain()();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(confirmations, 4);
    assert.equal(
      shares,
      2,
      "an already-locked replay must not announce an unfinalized confirmation",
    );
    current = false;
    confirmAgain()();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      confirmations,
      4,
      "an expired session cannot confirm or share",
    );
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((item) => item.restore());
  }
});
