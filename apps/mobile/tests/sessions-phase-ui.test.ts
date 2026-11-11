import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { sessionPath } from "./fixtures/session-path";
import { resolveSessionContext } from "../src/features/sessions/utils/session-context";

type Element = { type: unknown; props: Record<string, unknown> };
function expand(tree: unknown): unknown {
  if (Array.isArray(tree)) return tree.map(expand);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return tree;
  const el = tree as Element;
  return typeof el.type === "function"
    ? expand(el.type(el.props))
    : { ...el, props: { ...el.props, children: expand(el.props.children) } };
}
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const el = tree as Element;
  return [el, ...elements(el.props.children)];
}
function text(tree: unknown): string {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join("");
  return tree && typeof tree === "object" && "props" in tree
    ? text((tree as Element).props.children)
    : "";
}
function load(file: string, extra: Record<string, Record<string, unknown>>) {
  const local = createRequire(
    new URL(`../src/features/${file}`, import.meta.url),
  );
  const filename = local.resolve(`./${file.split("/").at(-1)}`);
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const stubs = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": {
      Text: "Text",
      View: "View",
      StyleSheet: { create: (v: unknown) => v },
    },
    "@/components/Button": { Button: "Button" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    ...extra,
  };
  const mocks = Object.entries(stubs).map(([id, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(id)), { namedExports }),
  );
  delete local.cache[filename];
  return {
    module: local(filename),
    cleanup() {
      delete local.cache[filename];
      mocks.reverse().forEach((m) => m.restore());
    },
  };
}

test("Plan timeline opens actual Session UUID and shows effective duration before a pending proposal", () => {
  const { plan, session, schedule } = sessionPath();
  schedule.items[0]!.endAt = "2030-01-02T13:00:00Z";
  const routes: unknown[] = [];
  const h = load("learning-paths/components/plan-detail-content.tsx", {
    "expo-router": {
      useRouter: () => ({ push: (href: unknown) => routes.push(href) }),
    },
    "@/components/learning-flow": { FlowSection: "Section" },
    "./schedule-timeline-item": { ScheduleTimelineItem: "TimelineItem" },
  });
  try {
    const render = () =>
      expand(h.module.PlanDetailContent({ plan, skill: "React", mine: true }));
    const button = elements(render()).find((el) => el.type === "Button")!;
    (button.props.onPress as () => void)();
    assert.deepEqual(routes, [`/learning-sessions/${session.id}`]);
    assert.match(text(render()), /60 phút/);
    plan.sessions = [];
    assert.equal(
      elements(render()).filter((el) => el.type === "Button").length,
      0,
    );
  } finally {
    h.cleanup();
  }
});

const pageStubs = {
  SessionPanel: "Panel",
  SessionCopy: "Copy",
  SessionButton: "Button",
  SessionRouteButton: "RouteButton",
  SessionPage: "Page",
  SessionEmptyState: "Empty",
};
test("Session content keeps server progress when Path context is denied and can retry independently", () => {
  const { session, path } = sessionPath();
  session.progress = {
    agreement: { completed: 1, total: 2 },
    plan: { completed: 1, total: 1 },
  };
  let context = resolveSessionContext(session, path),
    retries = 0;
  let error: unknown;
  const routes: unknown[] = [];
  const h = load("sessions/components/session-context-panel.tsx", {
    "./session-page": pageStubs,
    "./session-lesson-content": {
      SessionLessonContent: ({ content }: { content: string }) => content,
    },
    "expo-router": {
      useRouter: () => ({ push: (href: unknown) => routes.push(href) }),
    },
    "../hooks/use-session-context": {
      useSessionContext: () => ({
        context,
        error,
        isLoading: false,
        isFetching: false,
        refetch: () => {
          retries++;
        },
      }),
    },
  });
  try {
    const render = () => expand(h.module.SessionContextPanel({ session }));
    assert.match(text(render()), /Thực hành/);
    const link = elements(render()).find(
      (el) =>
        el.type === "Button" && el.props.accessibilityLabel === "Xem lộ trình",
    )!;
    (link.props.onPress as () => void)();
    assert.deepEqual(routes, [`/paths/${path.id}/plans/${session.planId}`]);
    assert.doesNotMatch(text(render()), /Lộ trình bản/);
    assert.deepEqual(
      elements(render()).find(
        (el) => el.props.accessibilityRole === "progressbar",
      )?.props.accessibilityValue,
      { min: 0, max: 1, now: 1, text: "1/1 buổi hoàn thành" },
    );
    error = new Error("temporary refresh failure");
    assert.match(text(render()), /Thực hành/);
    assert.ok(elements(render()).some((el) => el.type === "Button"));
    context = undefined;
    error = new Error("denied");
    assert.doesNotMatch(text(render()), /Thực hành/);
    assert.match(text(render()), /1\/2 buổi/);
    assert.match(text(render()), /Bạn vẫn có thể xem thông tin buổi học/);
    (
      elements(render()).find((el) => el.type === "Button")!.props
        .onPress as () => void
    )();
    assert.equal(retries, 1);
  } finally {
    h.cleanup();
  }
});

test("Path Session list renders sessions outside the current month and has a Path fallback", () => {
  const { path, plan } = sessionPath();
  plan.sessions.push({
    ...plan.sessions[0]!,
    id: "20000000-0000-4000-8000-000000000099",
    sessionNo: 2,
    startAt: "2030-06-01T00:00:00Z",
    endAt: "2030-06-01T01:00:00Z",
  });
  plan.totalSessions = 2;
  const reciprocal = path.plans.find((row) => row.id !== plan.id)!;
  reciprocal.sessions = [
    {
      ...plan.sessions[0]!,
      id: "20000000-0000-4000-8000-000000000098",
      startAt: "2030-03-01T00:00:00Z",
      endAt: "2030-03-01T01:00:00Z",
    },
  ];
  const h = load("sessions/screens/session-list-screen.tsx", {
    "expo-router": { useLocalSearchParams: () => ({ id: path.id }) },
    "@/features/learning-paths/state": {
      useLearningPath: () => ({
        data: path,
        denied: false,
        error: undefined,
        isFetching: false,
        refetch: () => {},
      }),
    },
    "@/features/connections": { useConnections: () => ({ enabled: true }) },
    "../components/session-page": pageStubs,
    "../components/session-card": { SessionCard: "Card" },
    "../components/session-feedback": { SessionFeedback: "Feedback" },
  });
  try {
    const tree = expand(h.module.PathSessionsScreen());
    assert.equal((tree as Element).props.back, `/paths/${path.id}`);
    assert.equal((tree as Element).props.title, "Tất cả buổi học");
    const cards = elements(tree).filter((el) => el.type === "Card");
    assert.equal(cards.length, 3);
    const sessions = cards.map(
      (card) =>
        card.props.session as { id: string; planId: string; startAt: string },
    );
    assert.equal(new Set(sessions.map((session) => session.planId)).size, 2);
    assert.equal(new Set(sessions.map((session) => session.id)).size, 3);
    assert.deepEqual(
      sessions.map((session) => session.startAt),
      [
        plan.sessions[0]!.startAt,
        reciprocal.sessions[0]!.startAt,
        plan.sessions[1]!.startAt,
      ],
    );
  } finally {
    h.cleanup();
  }
});
