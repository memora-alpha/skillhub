import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  agreementPath,
  withConfirmedSchedules,
} from "./fixtures/learning-agreement";
import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../src/features/learning-paths/api/learning-paths-contract";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [
    element,
    ...elements(element.props.children),
    ...elements(element.props.action),
  ];
}

function harness(schedule: boolean) {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/components/plan-editor-form.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve(
    schedule ? "./schedule-editor-form.tsx" : "./plan-editor-form.tsx",
  );
  const hook = local.resolve("../hooks/use-editor-snapshot.ts");
  const slots: unknown[] = [];
  let cursor = 0;
  let draft: Record<string, unknown> | undefined;
  const calls: unknown[][] = [];
  const errors: { field: string; message: string }[] = [];
  let resets = 0;
  let validate: (send: () => Promise<void>) => Promise<void> = async (send) =>
    send();
  const command = {
    pending: false,
    uncertain: false,
    run: async (_key: string, send: () => Promise<unknown>) => send(),
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useRef: (current: unknown) => {
        const index = cursor++;
        slots[index] ??= { current };
        return slots[index];
      },
      useState: (initial: unknown) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [
          slots[index],
          (value: unknown) => {
            slots[index] =
              typeof value === "function" ? value(slots[index]) : value;
          },
        ];
      },
    },
    "react-native": {
      View: "View",
      Text: "Text",
      StyleSheet: { create: (value: unknown) => value },
    },
    "react-hook-form": {
      useForm: ({
        defaultValues,
      }: {
        defaultValues: Record<string, unknown>;
      }) => {
        draft ??= structuredClone(defaultValues);
        return {
          control: {},
          formState: { errors: {} },
          setValue: () => {},
          setError: (field: string, error: { message: string }) => {
            errors.push({ field, message: error.message });
          },
          watch: (key: string) => draft![key],
          reset: (value: Record<string, unknown>) => {
            resets++;
            draft = structuredClone(value);
          },
          handleSubmit: (send: (values: unknown) => Promise<void>) => () =>
            validate(() => send(draft)),
        };
      },
    },
    "expo-router": { useRouter: () => ({ dismissTo: () => {} }) },
    "@hookform/resolvers/zod": { zodResolver: () => ({}) },
    "@/components/feature-page": { Copy: "Copy", RouteButton: "RouteButton" },
    "@/components/learning-flow": { FlowSection: "Panel" },
    "@/components/Button": { Button: "Button" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/features/connections": {
      ConnectionFeedback: "Feedback",
      useConnectionCommand: () => command,
      useCatalogName: () => ({}),
    },
    "@/features/learning-requests": { useSkillOptions: () => ({}) },
    "../hooks/use-learning-paths-api": {
      useLearningPathsApi: () => ({
        revisePlan: async (...args: unknown[]) => {
          calls.push(args);
          return { id: "saved" };
        },
        reviseSchedule: async (...args: unknown[]) => {
          calls.push(args);
          return { id: "saved" };
        },
      }),
    },
    "./plan-editor-fields": {
      PlanEditorFrame: "Frame",
      PlanSkillPicker: "Skills",
      PlanGoalField: "Goal",
    },
    "./plan-outline-editor": { PlanOutlineEditor: "Outline" },
    "./schedule-weekly-generator": { ScheduleWeeklyGenerator: "Generator" },
    "./schedule-session-editor": { ScheduleSessionEditor: "Sessions" },
    "./editor-revision-notice": { EditorRevisionNotice: "Revision" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  delete local.cache[filename];
  delete local.cache[hook];
  const source = local(filename) as {
    PlanForm: (props: unknown) => unknown;
    ScheduleForm: (props: unknown) => unknown;
  };
  const path = withConfirmedSchedules(agreementPath());
  return {
    path,
    command,
    calls,
    errors,
    render: (
      currentPath = path,
      plan: ApiLearningPlan = currentPath.plans[0]!,
      blocked = false,
    ) => {
      cursor = 0;
      return elements(
        (schedule ? source.ScheduleForm : source.PlanForm)({
          path: currentPath,
          plan,
          blocked,
        }),
      );
    },
    draft: () => draft!,
    resets: () => resets,
    setValidation: (fn: typeof validate) => {
      validate = fn;
    },
    cleanup() {
      delete local.cache[filename];
      delete local.cache[hook];
      for (const context of contexts.reverse()) context.restore();
    },
  };
}
const save = (tree: Element[]) =>
  tree.find((node) => node.type === "Frame")!.props.action as Element;
const revision = (tree: Element[]) =>
  tree.find((node) => node.type === "Revision")!;
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

for (const schedule of [false, true])
  test(`${schedule ? "schedule" : "plan"} revision preserves the local draft, blocks stale callbacks, and reloads only on request`, async () => {
    const h = harness(schedule);
    try {
      const original = h.render();
      const originalDraft = h.draft();
      if (schedule)
        originalDraft.items = [{ local: "2098-01-01T19:30", minutes: "90" }];
      else originalDraft.learningGoal = "Unsaved local goal";
      const latest = structuredClone(h.path);
      const latestPlan = latest.plans[0]!;
      if (schedule) {
        latestPlan.schedule!.version++;
        latestPlan.schedule!.items[0]!.startAt = "2098-02-01T19:30:00Z";
        latestPlan.schedule!.items[0]!.endAt = "2098-02-01T21:00:00Z";
      } else {
        latestPlan.version++;
        latestPlan.learningGoal = "Remote goal";
      }
      const changed = h.render(latest);
      assert.equal(h.draft(), originalDraft);
      assert.equal(h.resets(), 0);
      assert.equal(save(changed).props.disabled, true);
      assert.equal(revision(changed).props.visible, true);
      (save(original).props.onPress as () => void)();
      await tick();
      assert.equal(
        h.calls.length,
        0,
        "an old event handler cannot save against an unseen version",
      );
      h.command.uncertain = true;
      assert.equal(revision(h.render(latest)).props.disabled, true);
      h.command.uncertain = false;
      (revision(h.render(latest)).props.onReload as () => void)();
      assert.equal(h.resets(), 1);
      const refreshed = h.render(latest);
      assert.equal(save(refreshed).props.disabled, false);
      assert.equal(revision(refreshed).props.visible, false);
      (save(original).props.onPress as () => void)();
      await tick();
      assert.equal(
        h.calls.length,
        0,
        "explicit reload cannot revive an old save callback",
      );
      if (!schedule) assert.equal(h.draft().learningGoal, "Remote goal");
      (save(refreshed).props.onPress as () => void)();
      await tick();
      assert.equal(h.calls.length, 1);
      assert.equal(
        h.calls[0]![schedule ? 1 : 2],
        schedule ? latestPlan.schedule!.version : latestPlan.version,
      );
    } finally {
      h.cleanup();
    }
  });

test("schedule precision errors open the affected session without sending or losing the draft", async () => {
  const h = harness(true);
  try {
    const path = structuredClone(h.path);
    const plan = path.plans[0]!;
    plan.totalSessions = 2;
    plan.schedule!.items = [
      {
        sessionNo: 1,
        startAt: "2098-01-01T19:30:27Z",
        endAt: "2098-01-01T20:30:27Z",
      },
      {
        sessionNo: 2,
        startAt: "2098-01-01T20:31:00Z",
        endAt: "2098-01-01T21:31:00Z",
      },
    ];
    const original = h.render(path);
    const items = h.draft().items as { local: string; minutes: string }[];
    items[0]!.minutes = "61";
    (save(original).props.onPress as () => void)();
    await tick();
    assert.equal(h.calls.length, 0);
    assert.equal(h.errors[0]!.field, "items.1.local");
    assert.match(h.errors[0]!.message, /không trùng/);
    assert.equal(items[0]!.minutes, "61");
    assert.equal(h.resets(), 0);
    assert.equal(
      h.render(path).find((el) => el.type === "Sessions")!.props.active,
      1,
    );
  } finally {
    h.cleanup();
  }
});

test("a revision arriving during async form validation cannot send the old draft", async () => {
  const h = harness(false);
  try {
    const original = h.render();
    let release: () => void = () => {};
    h.setValidation(
      (send) =>
        new Promise<void>((resolve) => {
          release = () => {
            void send().then(resolve);
          };
        }),
    );
    (save(original).props.onPress as () => void)();
    const latest: ApiLearningPath = structuredClone(h.path);
    latest.plans[0]!.version++;
    h.render(latest);
    release();
    await tick();
    assert.equal(h.calls.length, 0);
    assert.equal(h.resets(), 0);
  } finally {
    h.cleanup();
  }
});

for (const schedule of [false, true])
  test(`${schedule ? "schedule" : "plan"} save stops if a refresh fails during async validation`, async () => {
    const h = harness(schedule);
    try {
      if (schedule) h.render();
      if (schedule)
        h.draft().items = [{ local: "2098-01-01T19:30", minutes: "90" }];
      const original = h.render();
      let release = () => {};
      h.setValidation(
        (send) =>
          new Promise<void>((resolve) => {
            release = () => {
              void send().then(resolve);
            };
          }),
      );
      (save(original).props.onPress as () => void)();
      const blocked = h.render(h.path, h.path.plans[0]!, true);
      assert.equal(save(blocked).props.disabled, true);
      release();
      await tick();
      assert.equal(
        h.calls.length,
        0,
        "a newly failed read must block a previously started save",
      );
    } finally {
      h.cleanup();
    }
  });
