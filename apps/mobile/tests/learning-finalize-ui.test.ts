import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { components, load, nodes, type Props } from "./fixtures/proposal-ui";
import { journeyIds, journeyPath } from "./fixtures/learning-journey-data";
import { learningJourney } from "../src/features/learning-paths/journey";

function expand(tree: React.ReactNode): React.ReactNode {
  if (Array.isArray(tree)) return tree.map(expand);
  if (!React.isValidElement<Props>(tree)) return tree;
  if (typeof tree.type === "function")
    return expand((tree.type as (p: Props) => React.ReactNode)(tree.props));
  return React.cloneElement(tree, {}, expand(tree.props.children));
}
function harness() {
  const path = journeyPath(true);
  const query = {
    data: path,
    error: undefined as unknown,
    isFetching: false,
    refetch: () => {},
  };
  const check = {
    ready: true,
    canFinalize: true,
    isFetching: false,
    error: undefined,
    refetch: () => {},
  };
  const calls: unknown[][] = [];
  const command = {
    pending: false,
    uncertain: false,
    run: async (
      _fingerprint: string,
      send: (key: string) => Promise<unknown>,
    ) => send("same-finalize-key"),
    retry: async () => {
      calls.push(["retry-original"]);
      return {};
    },
  };
  const api = {
    finalize: async (...args: unknown[]) => {
      calls.push(args);
      return {};
    },
  };
  const screen = load(
    "../../src/features/learning-paths/screens/ApiHoldScreen.tsx",
    {
      ...components,
      "expo-router": { useLocalSearchParams: () => ({ id: path.id }) },
      "@/features/connections": {
        ConnectionFeedback: "Feedback",
        useConnections: () => ({ userId: journeyIds.me }),
        useConnectionCommand: () => command,
        useCatalogName: () => ({ data: "React" }),
      },
      "../hooks/use-learning-paths-api": {
        useLearningPath: () => query,
        useLearningPathsApi: () => api,
      },
      "../hooks/use-final-validation": {
        useFinalValidation: (_path: unknown, blocked: boolean) => ({
          ...check,
          canFinalize: check.canFinalize && !blocked,
        }),
      },
      "../components/PathReadFeedback": { PathReadFeedback: "Feedback" },
      "../components/LearningJourney": {
        JourneyProgress: "Progress",
        JourneyNextStep: "Next",
      },
      "../journey": { learningJourney },
    },
  ).ApiHoldScreen!;
  return {
    path,
    query,
    check,
    command,
    calls,
    render: () => expand(screen({})),
  };
}
const confirmButton = (tree: React.ReactNode) =>
  nodes(tree, "Button").find((n) =>
    /^(Chốt lịch|Đang chốt lịch)/.test(String(n.props.children)),
  )!.props;

test("reviewing a ready path never finalizes until the explicit Credit button is pressed", async () => {
  const h = harness();
  const button = confirmButton(h.render());
  assert.deepEqual(h.calls, []);
  assert.equal(button.children, "Chốt lịch và tạm giữ 40.00 Credit");
  (button.onPress as () => void)();
  await Promise.resolve();
  assert.deepEqual(h.calls, [[h.path.id, 1, "same-finalize-key"]]);
});
test("checking, failed validation, stale snapshots and unknown outcomes block new finalization", () => {
  for (const mutate of [
    (h: ReturnType<typeof harness>) => {
      h.check.canFinalize = false;
      h.check.isFetching = true;
    },
    (h: ReturnType<typeof harness>) => {
      h.check.canFinalize = false;
    },
    (h: ReturnType<typeof harness>) => {
      h.command.pending = true;
    },
    (h: ReturnType<typeof harness>) => {
      h.command.uncertain = true;
    },
    (h: ReturnType<typeof harness>) => {
      h.query.error = new Error("snapshot refresh failed");
    },
    (h: ReturnType<typeof harness>) => {
      h.query.isFetching = true;
    },
  ]) {
    const h = harness();
    mutate(h);
    const button = confirmButton(h.render());
    assert.equal(button.disabled, true);
    (button.onPress as () => void)();
    assert.deepEqual(h.calls, []);
  }
});
test("ONE_WAY teachers see zero personal hold and locked paths keep only original-command recovery", () => {
  const h = harness();
  h.path.agreement.exchangeType = "ONE_WAY";
  h.path.agreement.teacherId = journeyIds.me;
  h.path.agreement.learnerId = journeyIds.other;
  assert.equal(
    confirmButton(h.render()).children,
    "Chốt lịch · bạn không giữ Credit",
  );
  h.path.lockedVersion = 1;
  h.path.status = "SCHEDULED";
  h.command.uncertain = true;
  const tree = h.render();
  assert.equal(
    nodes(tree, "Button").some((n) =>
      String(n.props.children).startsWith("Chốt lịch"),
    ),
    false,
  );
  const retry = nodes(tree, "Button").find(
    (n) => n.props.children === "Kiểm tra lại lần chốt vừa gửi",
  )!;
  (retry.props.onPress as () => void)();
  assert.deepEqual(h.calls, [["retry-original"]]);
});
