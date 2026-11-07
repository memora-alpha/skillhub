import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { agreementPath } from "./fixtures/learning-agreement";
import { terminationFixture } from "./fixtures/path-changes-data";
import { fixtureId } from "./fixtures/learning-requests-data";

type Element = { type: unknown; props: Record<string, unknown> };
function nodes(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const node = tree as Element;
  return [node, ...nodes(node.props.children)];
}

test("direct cancellation links block new requests after completion but retain existing requests and history", () => {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/screens/cancellation-screen.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./cancellation-screen.tsx");
  const path = agreementPath(true);
  path.status = "ACTIVE";
  path.lockedVersion = path.currentVersion;
  const request = terminationFixture({ pathId: path.id });
  const pathQuery = {
    data: path,
    error: undefined as unknown,
    isFetching: false,
  };
  const query = {
    data: [request],
    error: undefined as unknown,
    isFetching: false,
  };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({
    type,
    props,
  });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "expo-router": {
      useLocalSearchParams: () => ({
        id: path.id,
        changeRequestId: request.id,
      }),
    },
    "@tanstack/react-query": { useQueryClient: () => ({}) },
    "@/features/connections": {
      useConnections: () => ({ key: ["owner"], isCurrent: () => true }),
    },
    "@/components/EmptyState": { EmptyState: "Empty" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/components/learning-flow": { FlowPage: "Page" },
    "@/components/feature-page": { Copy: "Copy", RouteButton: "Link" },
    "../components/PathReadFeedback": { PathReadFeedback: "Feedback" },
    "../components/termination-create-form": {
      TerminationCreateForm: "Create",
    },
    "../components/termination-requests": { TerminationRequests: "Requests" },
    "../components/termination-credit-preview": {
      TerminationCreditPreview: "Quote",
    },
    "../hooks/use-learning-paths-api": { useLearningPath: () => pathQuery },
    "../hooks/use-path-changes": {
      useTerminationRequests: () => query,
      usePathSettlement: () => undefined,
    },
    "../hooks/use-pull-refresh": {
      usePullRefresh: () => ({ refreshing: false }),
    },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { PathCancellationScreen } = local(filename);
    const render = () => {
      const element = PathCancellationScreen();
      return nodes(element.type(element.props));
    };
    query.data = [];
    assert.ok(render().some((node) => node.type === "Create"));
    for (const [index, plan] of path.plans.entries()) {
      plan.sessions = [
        {
          id: fixtureId(70 + index),
          sessionNo: 1,
          status: "COMPLETED",
          startAt: "2030-01-02T10:00:00Z",
          endAt: "2030-01-02T11:00:00Z",
        },
      ];
    }
    const tree = render();
    assert.equal(
      tree.some((node) => node.type === "Create" || node.type === "Quote"),
      false,
    );
    assert.ok(
      tree.some(
        (node) =>
          node.type === "Link" &&
          node.props.children === "Về bước Hoàn tất" &&
          node.props.href === `/paths/${path.id}`,
      ),
    );
    query.data = [request];
    const list = render().find((node) => node.type === "Requests")!;
    assert.deepEqual(list.props.requests, [request]);
    assert.equal(list.props.selectedId, request.id);
    request.status = "WITHDRAWN";
    assert.equal(
      render().some((node) => node.type === "Create"),
      false,
    );
    path.plans[1]!.sessions[0]!.status = "CONFIRMED";
    assert.ok(render().some((node) => node.type === "Create"));
    request.status = "PENDING"; // a new active request blocks another form
    assert.equal(
      render().some((node) => node.type === "Create"),
      false,
    );
    request.status = "WITHDRAWN";
    pathQuery.error = new Error("refresh failed");
    const form = render().find((node) => node.type === "Create")!;
    assert.equal(form.props.blocked, true);
  } finally {
    delete local.cache[filename];
    contexts.reverse().forEach((context) => context.restore());
  }
});
