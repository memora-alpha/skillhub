import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  agreementPath,
  teacherId,
  learnerId,
  withConfirmedSchedules,
} from "./fixtures/learning-agreement";

type Element = { type: unknown; props: Record<string, unknown> };
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (!value || typeof value !== "object" || !("props" in value)) return "";
  const element = value as Element;
  return typeof element.type === "function"
    ? text(element.type(element.props))
    : text(element.props.children);
}

test("schedule detail distinguishes exchange directions and maps session titles by number", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/components/schedule-read-card.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./schedule-read-card.tsx");
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const routes: unknown[] = [];
  const stubs = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View",
      Text: "Text",
      StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
    },
    "expo-router": {
      useRouter: () => ({ dismissTo: (route: unknown) => routes.push(route) }),
    },
    "@/components/learning-flow": { FlowSection: "Section" },
    "@/components/Button": { Button: "Button" },
    "@/components/Icon": { Icon: "Icon" },
    "./agreement-progress": { AgreementProgressPanel: "Progress" },
    "./schedule-timeline-item": { ScheduleTimelineItem: "TimelineItem" },
  };
  const mocks = Object.entries(stubs).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  mocks.push(
    mock.module(pathToFileURL(local.resolve("react-native-svg")), {
      defaultExport: { __esModule: true, default: "Svg", Line: "Line" },
    }),
  );
  try {
    delete local.cache[filename];
    const { ScheduleExchangeContext, ScheduleReadCard } = local(
      filename,
    ) as typeof import("../src/features/learning-paths/components/schedule-read-card");
    const path = withConfirmedSchedules(agreementPath(true));
    const plan = path.plans[0]!;
    plan.sessionOutline = [
      { sessionNo: 2, content: "Buổi tiếp theo" },
      {
        sessionNo: 1,
        content: "React components\nMô tả tùy chọn không cần lặp trong lịch",
      },
    ];
    assert.match(
      text(ScheduleExchangeContext({ path })),
      /Trao đổi hai chiều.*bạn dạy và bạn học/,
    );
    assert.match(
      text(ScheduleExchangeContext({ path: agreementPath() })),
      /Học một chiều/,
    );
    const render = (userId: string) =>
      text(
        ScheduleReadCard({
          path,
          plan,
          userId,
          skill: "React",
          children: null,
        }),
      );
    assert.match(render(teacherId), /Bạn dạy/);
    assert.match(render(learnerId), /Bạn học/);
    assert.match(render(teacherId), /Buổi 1 · React components/);
    assert.doesNotMatch(
      render(teacherId),
      /Buổi 1 · Buổi tiếp theo|Mô tả tùy chọn/,
    );
    assert.match(render(teacherId), /Đủ xác nhận/);
    plan.sessionOutline = [];
    assert.match(render(teacherId), /Buổi 1/);
    assert.doesNotMatch(render(teacherId), /undefined|Buổi 1 ·/);
    plan.sessionOutline = [{ sessionNo: 1, content: "Session đã tạo" }];
    plan.sessions = [
      { ...plan.schedule!.items[0]!, id: plan.id, status: "CONFIRMED" },
    ];
    assert.match(render(teacherId), /Buổi học đã tạo.*Buổi 1 · Session đã tạo/);
    plan.sessions = [];
    plan.totalSessions = 2;
    plan.schedule!.status = "NEEDS_REVISION";
    plan.schedule!.participantAConfirmedAt = null;
    plan.schedule!.participantBConfirmedAt = null;
    plan.sessionOutline.push({ sessionNo: 2, content: "Buổi mới" });
    assert.match(
      render(teacherId),
      /Cần điều chỉnh.*1\s*\/\s*2\s+buổi sẵn sàng/,
    );
    assert.match(render(teacherId), /Buổi 2 · Buổi mới.*Chưa có ngày giờ/);
    plan.schedule = null;
    assert.match(
      render(learnerId),
      /Chưa có đề xuất lịch.*Chờ đối tác đề xuất.*Nhắc đối tác qua chat/,
    );
    assert.doesNotMatch(render(teacherId), /Nhắc đối tác qua chat/);
    const { ScheduleMissingPlanCard } = local(
      filename,
    ) as typeof import("../src/features/learning-paths/components/schedule-read-card");
    assert.match(
      text(ScheduleMissingPlanCard({ path, mine: false, blocked: false })),
      /Lịch bạn học.*Chờ lộ trình.*Đối tác chưa tạo/,
    );
    const { ScheduleChatReminder } = local(
      "./schedule-chat-reminder.tsx",
    ) as typeof import("../src/features/learning-paths/components/schedule-chat-reminder");
    const blocked = ScheduleChatReminder({
      conversationId: path.conversationId,
      blocked: true,
    }) as Element;
    (blocked.props.onPress as () => void)();
    assert.deepEqual(routes, []);
    const reminder = ScheduleChatReminder({
      conversationId: path.conversationId,
      blocked: false,
    }) as Element;
    (reminder.props.onPress as () => void)();
    assert.deepEqual(routes, [
      {
        pathname: "/chat/[proposalId]",
        params: { proposalId: path.conversationId, mode: "api" },
      },
    ]);
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((item) => item.restore());
  }
});
