import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { agreementPath } from "./fixtures/learning-agreement";

type Element = { type: unknown; props: Record<string, unknown> };
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [
    element,
    ...elements(element.props.children),
    ...elements(element.props.action),
  ];
}
test("schedule editor applies only to draft, submits exact plan version, and remains usable during background refresh", async () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/components/schedule-editor-form.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./schedule-editor-form.tsx");
  const path = agreementPath();
  const plan = path.plans[0]!;
  let items = [{ local: "2098-01-01T19:30", minutes: "60" }];
  const calls: unknown[] = [],
    routes: string[] = [];
  const command = {
    pending: false,
    uncertain: false,
    run: async (_fingerprint: string, send: () => Promise<unknown>) => send(),
  };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const stubs: Record<string, Record<string, unknown>> = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: { useState: (value: unknown) => [value, () => {}] },
    "react-native": {
      View: "View",
      Text: "Text",
      StyleSheet: { create: (value: unknown) => value },
    },
    "react-hook-form": {
      useForm: () => ({
        control: {},
        setValue: (_name: string, value: typeof items) => {
          items = value;
        },
        handleSubmit: (send: (value: unknown) => Promise<unknown>) => () =>
          send({ items }),
      }),
    },
    "expo-router": {
      useRouter: () => ({ dismissTo: (href: string) => routes.push(href) }),
    },
    "@hookform/resolvers/zod": { zodResolver: () => ({}) },
    "@/components/feature-page": { Copy: "Copy", RouteButton: "RouteButton" },
    "@/components/learning-flow": { FlowSection: "Section" },
    "@/components/Button": { Button: "Button" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/features/connections": {
      ConnectionFeedback: "Feedback",
      useConnectionCommand: () => command,
    },
    "../hooks/use-learning-paths-api": {
      useLearningPathsApi: () => ({
        schedule: async (...args: unknown[]) => {
          calls.push(args);
          return { id: "saved" };
        },
      }),
    },
    "./plan-editor-fields": { PlanEditorFrame: "Frame" },
    "./schedule-weekly-generator": { ScheduleWeeklyGenerator: "Generator" },
    "./schedule-session-editor": { ScheduleSessionEditor: "Sessions" },
  };
  const mocks = Object.entries(stubs).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { ScheduleForm } = local(
      filename,
    ) as typeof import("../src/features/learning-paths/components/schedule-editor-form");
    const props = { path, plan, blocked: false };
    let tree = elements(ScheduleForm(props));
    const replacement = [{ local: "2098-02-02T20:00", minutes: "90" }];
    (
      tree.find((item) => item.type === "Generator")!.props.onApply as (
        value: typeof items,
      ) => void
    )(replacement);
    assert.equal(calls.length, 0);
    const save = tree.find((item) => item.type === "Button")!;
    (save.props.onPress as () => void)();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls.length, 1);
    const [id, version, slots] = calls[0] as [
      string,
      number,
      { sessionNo: number; startAt: string; endAt: string }[],
    ];
    assert.equal(id, plan.id);
    assert.equal(version, plan.version);
    assert.equal(slots[0]!.sessionNo, 1);
    assert.equal(
      Date.parse(slots[0]!.endAt) - Date.parse(slots[0]!.startAt),
      90 * 60000,
    );
    assert.deepEqual(routes, [`/paths/${path.id}/schedules`]);
    for (const state of ["pending", "uncertain", "blocked"]) {
      command.pending = state === "pending";
      command.uncertain = state === "uncertain";
      tree = elements(ScheduleForm({ ...props, blocked: state === "blocked" }));
      const button = tree.find((item) => item.type === "Button")!;
      assert.equal(button.props.disabled, true);
      (button.props.onPress as () => void)();
      (
        tree.find((item) => item.type === "Generator")!.props.onApply as (
          value: typeof items,
        ) => void
      )([]);
      assert.equal(items, replacement);
    }
    assert.equal(calls.length, 1);
    command.pending = false;
    command.uncertain = false;
    tree = elements(ScheduleForm(props));
    const backgroundRefreshSave = tree.find((item) => item.type === "Button")!;
    assert.equal(backgroundRefreshSave.props.disabled, false);
    assert.equal(
      tree.find((item) => item.type === "Generator")!.props.disabled,
      false,
    );
    assert.equal(
      tree.find((item) => item.type === "Sessions")!.props.disabled,
      false,
    );
    (backgroundRefreshSave.props.onPress as () => void)();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls.length, 2);
  } finally {
    delete local.cache[filename];
    mocks.reverse().forEach((item) => item.restore());
  }
});
