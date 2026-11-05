import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  agreementPath,
  learnerId,
  withConfirmedSchedules,
} from "./fixtures/learning-agreement";

type Element = { type: unknown; props: Record<string, unknown> };
function nodes(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...nodes(element.props.children)];
}
function text(tree: unknown): string {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree && typeof tree === "object" && "props" in tree)
    return text((tree as Element).props.children);
  return typeof tree === "string" ? tree : "";
}

test("the fourth step opens after learning, retains read-only agreement steps and distinguishes pending from settled Credit", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/components/completed-agreement-review.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./completed-agreement-review.tsx");
  const stepsFilename = local.resolve("./agreement-steps.tsx");
  let selected: unknown;
  const jsx = (type: unknown, props: Element["props"]) => ({ type, props });
  const mocks = {
    react: {
      useState: () => [
        selected,
        (value: unknown) => {
          selected = value;
        },
      ],
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": {
      View: "View",
      Text: "Text",
      Pressable: "Pressable",
      StyleSheet: { create: (value: unknown) => value },
    },
    "@/components/Button": { Button: "Button" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/feature-page": { Copy: "Copy" },
    "@/components/learning-flow": { FlowSection: "Section" },
    "@/features/connections": { useCatalogName: () => ({ data: "React" }) },
    "./agreement-method-summary": { AgreementMethodSummary: "MethodSummary" },
    "./plan-detail-content": { PlanDetailContent: "PlanDetail" },
    "./schedule-read-card": { ScheduleReadCard: "ScheduleCard" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  function expand(tree: unknown): unknown {
    if (Array.isArray(tree)) return tree.map(expand);
    if (!tree || typeof tree !== "object" || !("props" in tree)) return tree;
    const element = tree as Element;
    return typeof element.type === "function"
      ? expand(element.type(element.props))
      : {
          ...element,
          props: { ...element.props, children: expand(element.props.children) },
        };
  }
  try {
    delete local.cache[filename];
    delete local.cache[stepsFilename];
    const { CompletedAgreementReview } = local(filename);
    const { AgreementSteps } = local(stepsFilename);
    for (const twoWay of [false, true])
      for (const settled of [false, true]) {
        const path = withConfirmedSchedules(agreementPath(twoWay));
        path.lockedVersion = path.currentVersion;
        path.status = settled ? "COMPLETED" : "ACTIVE";
        path.settledAt = settled ? "2030-01-03T00:00:00Z" : null;
        const original = structuredClone(path);
        selected = "completion";
        const render = () =>
          selected === "completion"
            ? jsx("SettlementSummary", {})
            : expand(
                CompletedAgreementReview({
                  path,
                  userId: learnerId,
                  partnerName: "Đối tác",
                  step: selected,
                }),
              );
        const press = (tree: unknown, label: string) => {
          const action = nodes(tree).find(
            (node) =>
              node.props.accessibilityLabel === label ||
              (node.type === "Button" && text(node) === label),
          );
          assert.ok(action, label);
          (action.props.onPress as () => void)();
        };
        const stepper = () =>
          AgreementSteps({
            value: selected,
            current: "completion",
            completed: settled,
            scheduleLocked: true,
            onSelect: (value: string) => {
              selected = value;
            },
          });
        assert.match(
          text(stepper()),
          settled ? /Đã hoàn thành/ : /Chờ quyết toán/,
        );
        const steps = nodes(stepper()).filter(
          (node) => node.type === "Pressable",
        );
        assert.equal(steps.length, 4);
        assert.ok(steps.every((node) => node.props.disabled === false));
        press(stepper(), "Bước 2: Lộ trình");
        assert.deepEqual(
          nodes(render())
            .filter((node) => node.type === "PlanDetail")
            .map((node) => node.props.plan),
          path.plans,
        );
        press(stepper(), "Bước 3: Lịch học");
        assert.deepEqual(
          nodes(render())
            .filter((node) => node.type === "ScheduleCard")
            .map((node) => node.props.plan),
          path.plans,
        );
        assert.equal(
          nodes(render()).filter((node) => node.type === "Button").length,
          0,
        );
        press(stepper(), "Bước 1: Cách học");
        assert.ok(
          nodes(render()).some((node) => node.type === "MethodSummary"),
        );
        press(stepper(), "Bước 4: Hoàn tất");
        assert.ok(
          nodes(render()).some((node) => node.type === "SettlementSummary"),
        );
        assert.deepEqual(path, original);
      }
    const beforeCompletion = AgreementSteps({
      value: "schedules",
      current: "schedules",
      onSelect() {},
    });
    const fourth = nodes(beforeCompletion).find(
      (node) => node.props.accessibilityLabel === "Bước 4: Hoàn tất",
    );
    assert.equal(fourth?.props.disabled, true);
    assert.match(text(beforeCompletion), /Đang thống nhất/);
    const lockedSchedule = AgreementSteps({
      value: "schedules",
      current: "schedules",
      scheduleLocked: true,
      onSelect() {},
    });
    assert.match(text(lockedSchedule), /Đã chốt lịch/);
    assert.doesNotMatch(text(lockedSchedule), /Đang thống nhất/);
    const schedule = nodes(lockedSchedule).find(
      (node) => node.props.accessibilityLabel === "Bước 3: Lịch học",
    )!;
    assert.ok(
      nodes(schedule).some(
        (node) => node.type === "Icon" && node.props.name === "check",
      ),
    );
    assert.equal(
      nodes(lockedSchedule).find(
        (node) => node.props.accessibilityLabel === "Bước 4: Hoàn tất",
      )?.props.disabled,
      true,
    );
  } finally {
    delete local.cache[filename];
    delete local.cache[stepsFilename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
