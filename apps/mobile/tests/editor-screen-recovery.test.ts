import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  agreementPath,
  teacherId,
  withConfirmedSchedules,
} from "./fixtures/learning-agreement";
import type { ApiLearningPath } from "../src/features/learning-paths/api/learning-paths-contract";
import { fixtureId } from "./fixtures/learning-requests-data";

type Element = { type: unknown; props: Record<string, unknown>; key?: string };
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
}

for (const schedule of [false, true])
  test(`${schedule ? "schedule" : "plan"} screen keeps an opened draft read-only during agreement revision, but hides it after access is lost`, () => {
    const local = createRequire(
      new URL(
        "../src/features/learning-paths/screens/ApiPlanScreens.tsx",
        import.meta.url,
      ),
    );
    const filename = local.resolve(
      schedule ? "./ApiScheduleScreens.tsx" : "./ApiPlanScreens.tsx",
    );
    const path = withConfirmedSchedules(agreementPath());
    const params = { id: path.id, planId: path.plans[0]!.id };
    const query = {
      data: path as ApiLearningPath | undefined,
      error: undefined as unknown,
    };
    const opened = { current: undefined };
    const jsx = (type: unknown, props: unknown, key?: string) => ({
      type,
      props,
      key,
    });
    const mocks: Record<string, Record<string, unknown>> = {
      "react/jsx-runtime": { jsx, jsxs: jsx },
      react: {
        useRef: () => opened,
        useState: (value: unknown) => [value, () => {}],
        useCallback: (value: unknown) => value,
      },
      "expo-router": {
        useLocalSearchParams: () => params,
        useRouter: () => ({}),
        useFocusEffect: () => {},
      },
      "@/components/learning-flow": { FlowPage: "Page" },
      "@/components/feature-page": { Copy: "Copy", RouteButton: "RouteButton" },
      "@/components/Button": { Button: "Button" },
      "@/components/EmptyState": { EmptyState: "EmptyState" },
      "@/components/FormNotice": { FormNotice: "Notice" },
      "@/features/connections": {
        useConnections: () => ({ userId: teacherId }),
        ConnectionFeedback: "Feedback",
      },
      "@/features/messages": { useMessageSend: () => ({}) },
      "@/features/messages/state": {
        ConfirmedFormFeedback: "SharedFeedback",
        useConfirmedFormShare: () => ({}),
      },
      "../hooks/use-learning-paths-api": { useLearningPath: () => query },
      "../hooks/use-pull-refresh": { usePullRefresh: () => ({}) },
      "../components/PathReadFeedback": { PathReadFeedback: "ReadFeedback" },
      "../components/plan-editor-form": { PlanForm: "PlanForm" },
      "../components/plan-detail-content": { PlanShareCard: "ShareCard" },
      "./ApiPathDetailScreen": {
        ApiPlanActions: "PlanActions",
        ApiPlanPanel: "PlanPanel",
      },
      "./ApiHoldScreen": { ApiFinalizePanel: "Finalize" },
      "../components/schedule-editor-form": { ScheduleForm: "ScheduleForm" },
      "../components/schedule-read-card": {
        ScheduleListOverview: "Overview",
        ScheduleReadCard: "Card",
        ScheduleExchangeContext: "Context",
        ScheduleMissingPlanCard: "Missing",
        ScheduleTimezoneNotice: "Timezone",
      },
    };
    const contexts = Object.entries(mocks).map(([name, namedExports]) =>
      mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
    );
    try {
      delete local.cache[filename];
      const source = local(filename) as {
        ApiPlanEditorScreen: () => unknown;
        ApiScheduleEditorScreen: () => unknown;
      };
      const render = () =>
        elements(
          (schedule
            ? source.ApiScheduleEditorScreen
            : source.ApiPlanEditorScreen)(),
        );
      const form = () =>
        render().find(
          (node) => node.type === (schedule ? "ScheduleForm" : "PlanForm"),
        );
      const revision = structuredClone(path);
      revision.currentVersion++;
      revision.agreement.version++;
      revision.agreement.participantAConfirmedAt = null;
      revision.status = "PROPOSED";
      query.data = revision;
      assert.equal(
        form(),
        undefined,
        "a screen opened without edit permission cannot start an editor",
      );
      query.data = path;
      const original = form()!;
      assert.ok(original);
      assert.equal(original.props.blocked, false);
      query.data = revision;
      const preserved = form()!;
      assert.ok(preserved);
      assert.equal(preserved.key, original.key);
      assert.equal(preserved.props.blocked, true);
      query.data = undefined;
      query.error = new Error("forbidden");
      assert.equal(
        form(),
        undefined,
        "loss of authorized data unmounts the private draft",
      );
      params.id = fixtureId(95);
      query.data = { ...revision, id: params.id };
      query.error = undefined;
      assert.equal(
        form(),
        undefined,
        "the opened-editor latch cannot leak across resources",
      );
    } finally {
      delete local.cache[filename];
      for (const context of contexts.reverse()) context.restore();
    }
  });
