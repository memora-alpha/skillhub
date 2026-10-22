import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { canValidateForFinalize } from "../src/features/learning-paths/utils/policy-api";
import {
  agreementPath,
  withConfirmedSchedules,
} from "./fixtures/learning-agreement";

type Element = {
  type: string | ((props: Record<string, unknown>) => Element);
  props: Record<string, unknown>;
};
function elements(tree: unknown): Element[] {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== "object" || !("props" in tree)) return [];
  const element = tree as Element;
  return [element, ...elements(element.props.children)];
}
function text(tree: unknown): string {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree && typeof tree === "object" && "props" in tree)
    return text((tree as Element).props.children);
  return "";
}

function loadMocked<T>(
  local: ReturnType<typeof createRequire>,
  filename: string,
  modules: Record<string, Record<string, unknown>>,
) {
  const contexts: ReturnType<typeof mock.module>[] = [];
  const cleanup = () => {
    delete local.cache[filename];
    for (const context of contexts.reverse()) context.restore();
  };
  try {
    for (const [name, namedExports] of Object.entries(modules))
      contexts.push(
        mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
      );
    delete local.cache[filename];
    return { module: local(filename) as T, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

// Execute the real screen with host components and controlled hook results.
// This checks UI actions, not native rendering or a deployed financial transaction.
function holdHarness() {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/screens/ApiHoldScreen.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ApiHoldScreen.tsx");
  let checked: unknown;
  let commands = 0;
  let refreshes = 0;
  let finalizations = 0;
  let retries = 0;
  let current = true;
  const path = withConfirmedSchedules();
  const query = {
    data: path,
    error: undefined as unknown,
    isFetching: false,
    refetch: () => {
      refreshes++;
    },
  };
  let validation = { version: 3, planCount: 1, scheduleCount: 1 };
  const check = {
    pending: false,
    error: undefined,
    run: async (_fingerprint: string, send: () => Promise<unknown>) => send(),
  };
  const finalize = {
    pending: false,
    error: undefined,
    uncertain: false,
    run: async () => {
      finalizations++;
      finalize.uncertain = true;
      return undefined;
    },
    retry: async () => {
      retries++;
      return { pathId: path.id, version: 3 };
    },
  };
  const jsx = (type: Element["type"], props: Element["props"]) => ({
    type,
    props,
  });
  const mocks = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    react: {
      useState: () => [
        checked,
        (value: unknown) => {
          checked = value;
        },
      ],
    },
    "expo-router": { useLocalSearchParams: () => ({ id: path.id }) },
    "react-native": {
      View: "View",
      Text: "Text",
      StyleSheet: { create: (value: unknown) => value },
    },
    "@/components/Icon": { Icon: "Icon" },
    "../hooks/use-pull-refresh": {
      usePullRefresh: () => ({ refreshing: false, onRefresh() {} }),
    },
    "@/components/learning-flow": {
      FlowPage: "FeaturePage",
      FlowSection: "Panel",
    },
    "@/components/feature-page": {
      FeaturePage: "FeaturePage",
      Panel: "Panel",
      Copy: "Copy",
      RouteButton: "RouteButton",
    },
    "@/components/Button": { Button: "Button" },
    "@/components/FormNotice": { FormNotice: "FormNotice" },
    "@/features/connections": {
      ConnectionFeedback: "ConnectionFeedback",
      useConnections: () => ({ isCurrent: () => current }),
      useConnectionCommand: () => (commands++ === 0 ? check : finalize),
    },
    "../components/PathReadFeedback": { PathReadFeedback: "PathReadFeedback" },
    "../components/agreement-progress": {
      AgreementChatLink: "AgreementChatLink",
      AgreementProgressPanel: "AgreementProgressPanel",
    },
    "../hooks/use-learning-paths-api": {
      useLearningPath: () => query,
      useLearningPathsApi: () => ({ validate: async () => validation }),
    },
    "../utils/policy-api": { canValidateForFinalize },
  };
  const loaded = loadMocked<{ ApiHoldScreen: () => Element }>(
    local,
    filename,
    mocks,
  );
  const screen = loaded.module;
  return {
    query,
    validateAs(value: typeof validation) {
      validation = value;
    },
    expire() {
      current = false;
    },
    render() {
      commands = 0;
      const content = elements(screen.ApiHoldScreen()).find(
        (e) => typeof e.type === "function" && e.type.name === "HoldContent",
      )!;
      return (content.type as (props: Record<string, unknown>) => Element)(
        content.props,
      );
    },
    button(tree: Element, label: string) {
      const button = elements(tree).find(
        (e) => e.type === "Button" && text(e.props.children) === label,
      );
      assert.ok(button, `Missing button: ${label}`);
      return button.props as { disabled: boolean; onPress: () => void };
    },
    counts: () => ({ refreshes, finalizations, retries }),
    cleanup: loaded.cleanup,
  };
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test("Hold UI requires a matching server validation, then invalidates it when the snapshot changes", async () => {
  const h = holdHarness();
  try {
    const label = "Xác nhận chốt lịch và tạm giữ Credit";
    assert.equal(h.button(h.render(), label).disabled, true);
    h.validateAs({ version: 2, planCount: 1, scheduleCount: 1 });
    h.button(h.render(), "Kiểm tra điều kiện trên hệ thống").onPress();
    await flush();
    assert.equal(h.button(h.render(), label).disabled, true);
    h.validateAs({ version: 3, planCount: 1, scheduleCount: 1 });
    h.button(h.render(), "Kiểm tra điều kiện trên hệ thống").onPress();
    await flush();
    assert.equal(h.button(h.render(), label).disabled, false);
    h.query.data = { ...h.query.data, currentVersion: 4 };
    assert.equal(h.button(h.render(), label).disabled, true);
    assert.equal(h.counts().finalizations, 0);
  } finally {
    h.cleanup();
  }
});

test("unknown finalize exposes explicit recovery, blocks a new intent and refreshes after recovery", async () => {
  const h = holdHarness();
  try {
    const label = "Xác nhận chốt lịch và tạm giữ Credit";
    h.button(h.render(), "Kiểm tra điều kiện trên hệ thống").onPress();
    await flush();
    h.button(h.render(), label).onPress();
    await flush();
    assert.equal(h.button(h.render(), label).disabled, true);
    h.button(h.render(), "Kiểm tra lại lần chốt trước").onPress();
    await flush();
    assert.deepEqual(h.counts(), {
      finalizations: 1,
      retries: 1,
      refreshes: 1,
    });
  } finally {
    h.cleanup();
  }
});

test("refresh errors and expired sessions cannot unlock finalization", async () => {
  const h = holdHarness();
  try {
    h.query.error = new Error("refresh failed");
    assert.equal(
      h.button(h.render(), "Kiểm tra điều kiện trên hệ thống").disabled,
      true,
    );
    h.query.error = undefined;
    h.expire();
    h.button(h.render(), "Kiểm tra điều kiện trên hệ thống").onPress();
    await flush();
    assert.equal(
      h.button(h.render(), "Xác nhận chốt lịch và tạm giữ Credit").disabled,
      true,
    );
    h.query.data = { ...agreementPath(), plans: [] };
    assert.equal(
      h.button(h.render(), "Kiểm tra điều kiện trên hệ thống").disabled,
      true,
    );
  } finally {
    h.cleanup();
  }
});

function entryHarness() {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/components/ApiAgreementEntry.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./ApiAgreementEntry.tsx");
  const path = agreementPath();
  const query = {
    data: [] as unknown[] | undefined,
    error: undefined as unknown,
    isFetching: false,
    refetch() {},
  };
  let creates = 0;
  const effects: (() => void)[] = [];
  const creating = { current: false };
  const destinations: string[] = [];
  let current = true;
  const runtime = { userId: path.participantAId, isCurrent: () => current };
  const jsx = (type: Element["type"], props: Element["props"]) => ({
    type,
    props,
  });
  const mocks = {
    react: {
      useRef: () => creating,
      useEffect: (effect: () => void) => effects.push(effect),
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "expo-router": {
      Redirect: "Redirect",
      useRouter: () => ({
        push() {},
        replace: (href: string) => destinations.push(href),
      }),
    },
    "@/components/learning-flow": {
      FlowPage: "FeaturePage",
      FlowSection: "Panel",
    },
    "@/components/feature-page": {
      Panel: "Panel",
      Copy: "Copy",
      RouteButton: "RouteButton",
    },
    "@/features/connections": {
      ConnectionFeedback: "ConnectionFeedback",
      useConnections: () => runtime,
      useConnectionCommand: () => ({
        pending: false,
        uncertain: false,
        run: async (_key: string, send: () => unknown) => send(),
      }),
    },
    "./PathReadFeedback": { PathReadFeedback: "PathReadFeedback" },
    "@/features/messages/state": {
      useConfirmedFormShare: () => ({ publish: async () => {} }),
    },
    "./ApiAgreementForm": { ApiAgreementForm: "ApiAgreementForm" },
    "./agreement-steps": { AgreementSteps: "AgreementSteps" },
    "./ApiPathsContent": { ApiPathCard: "ApiPathCard" },
    "../hooks/use-learning-paths-api": {
      useLearningPaths: () => query,
      useLearningPathsApi: () => ({
        create: async () => {
          creates++;
          return { id: path.id, version: 1 };
        },
        confirm: async () => ({
          id: path.id,
          currentVersion: 1,
          status: "PARTIALLY_CONFIRMED",
        }),
      }),
    },
    "../api/creation-attempt": {
      createPathOnce: (_scope: string, send: () => unknown) => send(),
    },
  };
  const loaded = loadMocked<{
    ApiAgreementEntry: (props: Record<string, unknown>) => Element;
  }>(local, filename, mocks);
  const component = loaded.module;
  return {
    query,
    destinations,
    runEffects() {
      effects.splice(0).forEach((effect) => effect());
    },
    creates: () => creates,
    expire() {
      current = false;
    },
    render(blocked = false) {
      return component.ApiAgreementEntry({
        conversationId: path.conversationId,
        participantAId: path.participantAId,
        participantBId: path.participantBId,
        blocked,
      });
    },
    form(tree: Element) {
      return elements(tree).find((e) => e.type === "ApiAgreementForm")
        ?.props as
        | { pending: boolean; onSubmit: (input: unknown) => Promise<void> }
        | undefined;
    },
    cleanup: loaded.cleanup,
  };
}

test("conversation refresh failure blocks creation even when the path list is cached", async () => {
  const h = entryHarness();
  try {
    const form = h.form(h.render(true));
    assert.ok(form);
    assert.equal(form.pending, true);
    await form.onSubmit({});
    assert.equal(h.creates(), 0);
  } finally {
    h.cleanup();
  }
});

test("path-list refresh failure keeps the mounted form draft while blocking submission", async () => {
  const h = entryHarness();
  try {
    assert.ok(h.form(h.render()));
    h.query.error = new Error("refresh failed");
    const form = h.form(h.render());
    assert.ok(
      form,
      "Do not unmount the form just because a cached-list refresh fails",
    );
    assert.equal(form.pending, true);
    await form.onSubmit({});
    assert.equal(h.creates(), 0);
    h.query.data = undefined;
    assert.equal(
      h.form(h.render()),
      undefined,
      "Denied private data must not render a form",
    );
  } finally {
    h.cleanup();
  }
});

test("a full path-list snapshot does not imply this conversation has no existing path", () => {
  const h = entryHarness();
  try {
    h.query.data = Array.from({ length: 100 }, (_, index) => ({
      id: `other-${index}`,
      conversationId: "another-conversation",
    }));
    assert.equal(h.form(h.render()), undefined);
  } finally {
    h.cleanup();
  }
});

test("expired conversation session cannot submit a cached create form", async () => {
  const h = entryHarness();
  try {
    const form = h.form(h.render())!;
    h.expire();
    await form.onSubmit({});
    assert.equal(h.creates(), 0);
  } finally {
    h.cleanup();
  }
});

test("opening an existing conversation plan skips the intermediary list screen", () => {
  const h = entryHarness();
  try {
    const path = agreementPath();
    h.query.data = [{ id: path.id, conversationId: path.conversationId }];
    const ready = h.render();
    assert.deepEqual(
      elements(ready).find((e) => e.type === "Redirect")?.props.href,
      {
        pathname: "/paths/[id]",
        params: { id: path.id, fromConversation: path.conversationId },
      },
    );
    assert.equal(
      elements(ready).some((e) => e.type === "ApiPathCard"),
      false,
    );
    h.query.isFetching = true;
    const loading = h.render();
    assert.equal(
      elements(loading).some(
        (e) => e.type === "Redirect" || e.type === "ApiPathCard",
      ),
      false,
    );
    h.query.isFetching = false;
    h.query.error = new Error("Cannot trust refresh");
    const failed = h.render();
    assert.equal(
      elements(failed).some(
        (e) => e.type === "Redirect" || e.type === "ApiPathCard",
      ),
      false,
    );
    assert.equal(h.destinations.length, 0);
  } finally {
    h.cleanup();
  }
});

test("creating an agreement opens method confirmation rather than the plan editor", async () => {
  const h = entryHarness();
  try {
    const form = h.form(h.render());
    assert.ok(form);
    await form.onSubmit({
      exchangeType: "TWO_WAY",
      totalCreditPerUser: "20.00",
    });
    assert.equal(h.destinations.at(-1), `/paths/${agreementPath().id}`);
    assert.equal(
      h.destinations.some((href) => href.includes("/plans/new")),
      false,
    );
  } finally {
    h.cleanup();
  }
});
