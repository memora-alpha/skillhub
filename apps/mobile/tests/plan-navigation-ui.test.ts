import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  agreementPath,
  learnerId,
  withConfirmedSchedules,
} from "./fixtures/learning-agreement";
import { fixtureId } from "./fixtures/learning-requests-data";

type Element = { type: unknown; props: Record<string, unknown>; key?: string };
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
function text(tree: unknown): string {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join("");
  return tree && typeof tree === "object" && "props" in tree
    ? text((tree as Element).props.children)
    : "";
}

// Real screens and handlers; host mocks do not prove a native navigation stack.
function harness(detail: boolean) {
  const local = createRequire(
    new URL(
      "../src/features/learning-paths/screens/ApiPlanScreens.tsx",
      import.meta.url,
    ),
  );
  const filename = local.resolve(
    detail ? "./ApiPlanScreens.tsx" : "./ApiPathDetailScreen.tsx",
  );
  const methodFilename = local.resolve(
    "../components/agreement-method-step.tsx",
  );
  const planFormFilename = local.resolve("../components/plan-editor-form.tsx");
  const plansStepFilename = local.resolve(
    "../components/agreement-plans-step.tsx",
  );
  const scheduleStepFilename = local.resolve(
    "../components/agreement-schedule-step.tsx",
  );
  const footerFilename = local.resolve("../components/agreement-footer.tsx");
  const path = agreementPath(true);
  const params: Record<string, string> = {
    id: path.id,
    planId: path.plans[0]!.id,
    sharedVersion: "2",
    fromConversation: path.conversationId,
  };
  const query = {
    data: path as typeof path | undefined,
    error: undefined as unknown,
    isFetching: false,
    refetch: () => {},
  };
  const routes: unknown[] = [],
    calls: unknown[] = [];
  const navigation: { method: string; href: unknown }[] = [];
  const command = {
    pending: false,
    uncertain: false,
    error: undefined,
    run: async (
      _fingerprint: string,
      send: (identity: string) => Promise<unknown>,
    ) => send(fixtureId(90)),
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
  const mocks: Record<string, Record<string, unknown>> = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    react: {
      useState: (initial: unknown) => [initial, () => {}],
      useRef: (current: unknown) => ({ current }),
      useCallback: (value: unknown) => value,
    },
    "react-native": {
      View: "View",
      Text: "Text",
      StyleSheet: { create: (value: unknown) => value },
    },
    "@/components/Icon": { Icon: "Icon" },
    "react-hook-form": {
      useForm: () => ({
        control: {},
        formState: { errors: {} },
        setValue: () => {},
        watch: (key: string) =>
          key === "sessionOutline"
            ? [{ content: "Thực hành" }]
            : key === "learningGoal"
              ? "Thực hành dự án"
              : (path.plans[1]?.skillId ?? ""),
        handleSubmit: (send: (input: unknown) => unknown) => () =>
          send({
            skillId: path.plans[1]?.skillId,
            learningGoal: "Thực hành dự án",
            sessionOutline: [{ content: "Thực hành" }],
          }),
      }),
    },
    "@hookform/resolvers/zod": { zodResolver: () => ({}) },
    "expo-router": {
      useLocalSearchParams: () => params,
      useRouter: () => ({
        push: (route: unknown) => {
          routes.push(route);
          navigation.push({ method: "push", href: route });
        },
        replace: (route: unknown) => {
          routes.push(route);
          navigation.push({ method: "replace", href: route });
        },
        dismissTo: (route: unknown) => {
          routes.push(route);
          navigation.push({ method: "dismissTo", href: route });
        },
      }),
      useFocusEffect: () => {},
    },
    "@/components/learning-flow": { FlowPage: "Page", FlowSection: "Panel" },
    "@/components/feature-page": { Copy: "Copy", RouteButton: "RouteButton" },
    "@/components/Button": { Button: "Button" },
    "@/components/ControlledInput": { ControlledInput: "Input" },
    "@/components/EmptyState": { EmptyState: "EmptyState" },
    "@/components/choice-group": { ChoiceGroup: "ChoiceGroup" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/features/connections": {
      ConnectionFeedback: "Feedback",
      useConnections: () => ({ userId: learnerId, isCurrent: () => true }),
      useConnectionCommand: () => command,
      useCatalogName: () => ({ data: "React" }),
      useParticipantName: () => ({ data: "Đối tác" }),
    },
    "@/features/learning-requests": { useSkillOptions: () => ({}) },
    "@/features/messages": { useMessageSend: () => ({}) },
    "@/features/messages/state": {
      useConfirmedFormShare: () => ({ publish: async () => {} }),
      ConfirmedFormFeedback: "FormFeedback",
    },
    "../components/PathReadFeedback": { PathReadFeedback: "ReadFeedback" },
    "../components/agreement-progress": {
      AgreementChatLink: "ChatLink",
      AgreementProgressPanel: "Progress",
    },
    "../components/ApiAgreementForm": { ApiAgreementForm: "AgreementForm" },
    "../components/agreement-steps": { AgreementSteps: "Steps" },
    "../components/plan-editor-fields": {
      PlanEditorFrame: "PlanFrame",
      PlanSkillPicker: "SkillPicker",
      PlanGoalField: "GoalField",
    },
    "../components/plan-outline-editor": { PlanOutlineEditor: "OutlineEditor" },
    "../components/agreement-context": { AgreementContext: "AgreementContext" },
    "../components/agreement-method-summary": {
      AgreementMethodSummary: "MethodSummary",
    },
    "../hooks/use-learning-paths-api": {
      useLearningPath: () => query,
      useLearningPathsApi: () => ({
        revisePlan: async (id: string, _input: unknown, version: number) => ({
          id,
          version: version + 1,
        }),
        revise: async (id: string, _input: unknown, version: number) => {
          calls.push({ revisionId: id, version });
          return { id, version: version + 1, status: "PROPOSED" };
        },
        confirm: async (id: string, version: number) => {
          calls.push({ agreementId: id, version });
          return { id, currentVersion: version, status: path.status };
        },
        confirmPlan: async (id: string, version: number) => {
          calls.push({ id, version });
          return { id, version, status: "CONFIRMED" };
        },
      }),
    },
  };
  if (detail)
    mocks["./ApiPathDetailScreen"] = {
      ApiPlanPanel: "PlanPanel",
      ApiPlanActions: "PlanActions",
    };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  contexts.push(
    mock.module(pathToFileURL(local.resolve("react-native-svg")), {
      defaultExport: { __esModule: true, default: "Svg", Line: "Line" },
    }),
  );
  delete local.cache[filename];
  delete local.cache[methodFilename];
  delete local.cache[planFormFilename];
  delete local.cache[plansStepFilename];
  delete local.cache[scheduleStepFilename];
  delete local.cache[footerFilename];
  const screen = local(filename) as {
    ApiPlanDetailScreen: () => Element;
    ApiPlanEditorScreen: () => Element;
    ApiPathDetailScreen: () => Element;
    ApiPlanPanel: (props: unknown) => Element;
    ApiPlanActions: (props: unknown) => Element;
  };
  function expand(tree: unknown): unknown {
    if (Array.isArray(tree)) return tree.map(expand);
    if (!tree || typeof tree !== "object" || !("props" in tree)) return tree;
    const element = tree as Element;
    return typeof element.type === "function"
      ? expand((element.type as (props: unknown) => unknown)(element.props))
      : {
          ...element,
          props: { ...element.props, children: expand(element.props.children) },
        };
  }
  return {
    path,
    params,
    query,
    routes,
    navigation,
    calls,
    command,
    screen,
    expand,
    render: () =>
      detail ? screen.ApiPlanDetailScreen() : screen.ApiPathDetailScreen(),
    cleanup: () => {
      delete local.cache[filename];
      delete local.cache[methodFilename];
      delete local.cache[planFormFilename];
      delete local.cache[plansStepFilename];
      delete local.cache[scheduleStepFilename];
      delete local.cache[footerFilename];
      for (const context of contexts.reverse()) context.restore();
    },
  };
}

test("shared detail uses history and Chat fallback even while loading or after a read failure", () => {
  const h = harness(true);
  try {
    for (const failing of [false, true]) {
      h.query.data = undefined;
      h.query.error = failing ? new Error("read failed") : undefined;
      const page = h.render();
      assert.equal(page.props.backBehavior, "history");
      assert.deepEqual(page.props.back, {
        pathname: "/chat/[proposalId]",
        params: { proposalId: h.path.conversationId, mode: "api" },
      });
      assert.equal(h.routes.length, 0);
    }
    delete h.params.fromConversation;
    assert.equal(h.render().props.back, "/messages");
  } finally {
    h.cleanup();
  }
});

test("a shared card opens only its plan in the source conversation, with a stale version notice", () => {
  const h = harness(true);
  try {
    h.params.sharedVersion = "1";
    assert.equal(
      elements(h.render()).filter((e) => e.type === "PlanPanel").length,
      1,
    );
    assert.match(text(h.render()), /đang đọc bản mới nhất/);
    h.params.fromConversation = fixtureId(99);
    assert.equal(
      elements(h.render()).filter((e) => e.type === "PlanPanel").length,
      0,
    );
    assert.ok(elements(h.render()).some((e) => e.type === "EmptyState"));
  } finally {
    h.cleanup();
  }
});

test("chat-origin plan detail hides duplicate sharing while internal detail keeps it", () => {
  const h = harness(true);
  try {
    const hasShareAction = () =>
      elements(h.render()).some(
        (element) =>
          typeof element.type === "function" &&
          element.type.name === "SharePlan",
      );
    assert.equal(hasShareAction(), false);
    delete h.params.sharedVersion;
    delete h.params.fromConversation;
    assert.equal(hasShareAction(), true);
  } finally {
    h.cleanup();
  }
});

test("agreement overview separates both directions and returns through history", () => {
  const h = harness(false);
  try {
    h.path.status = "PROPOSED";
    h.path.plans[0]!.status = "PROPOSED";
    h.path.plans[0]!.learnerConfirmedAt = null;
    const page = h.render();
    assert.equal(page.props.title, "Thỏa thuận học");
    assert.equal(page.props.backBehavior, "history");
    const tree = h.expand(page);
    assert.match(text(tree), /Bạn học/);
    assert.match(text(tree), /Bạn dạy/);
    assert.match(text(tree), /Bạn cần xác nhận/);
    assert.equal(
      elements(tree).filter((e) => e.type === "AgreementForm").length,
      0,
    );
    assert.equal(
      elements(tree).filter(
        (e) =>
          e.type === "Button" &&
          ["Xem chi tiết", "Xem và xác nhận lộ trình"].includes(
            String(e.props.children),
          ),
      ).length,
      2,
    );
  } finally {
    h.cleanup();
  }
});

test("TWO_WAY can create the teaching direction while the learning direction awaits confirmation", () => {
  const h = harness(false);
  try {
    h.path.status = "PROPOSED";
    h.path.plans.pop();
    h.path.plans[0]!.learnerConfirmedAt = null;
    h.path.plans[0]!.status = "PROPOSED";
    assert.ok(
      elements(h.expand(h.render())).some(
        (e) =>
          e.type === "Button" && e.props.children === "Tạo lộ trình bạn dạy",
      ),
    );
  } finally {
    h.cleanup();
  }
});

test("missing reciprocal plans show two honest states, block creation on read error, and return directly to Chat", () => {
  const h = harness(false);
  try {
    h.path.status = "PROPOSED";
    h.path.plans = [];
    h.query.error = new Error("read failed");
    let tree = h.expand(h.render());
    assert.match(text(tree), /Chờ đối tác tạo/);
    assert.match(text(tree), /Phần việc của bạn/);
    let create = elements(tree).find(
      (e) => e.type === "Button" && e.props.children === "Tạo lộ trình bạn dạy",
    )!;
    assert.equal(create.props.disabled, true);
    (create.props.onPress as () => void)();
    assert.equal(h.routes.length, 0);
    h.query.error = undefined;
    tree = h.expand(h.render());
    create = elements(tree).find(
      (e) => e.type === "Button" && e.props.children === "Tạo lộ trình bạn dạy",
    )!;
    (create.props.onPress as () => void)();
    assert.equal(h.routes[0], `/paths/${h.path.id}/plans/new`);
    const chat = elements(tree).find(
      (e) =>
        e.type === "Button" &&
        e.props.accessibilityLabel === "Trao đổi qua chat",
    )!;
    (chat.props.onPress as () => void)();
    assert.deepEqual(h.navigation[1], {
      method: "dismissTo",
      href: {
        pathname: "/chat/[proposalId]",
        params: { proposalId: h.path.conversationId, mode: "api" },
      },
    });
    assert.equal(h.calls.length, 0);
  } finally {
    h.cleanup();
  }
});

test("ONE_WAY learner sees only the teaching direction and opens its exact plan without confirming from overview", () => {
  const h = harness(false);
  try {
    h.path.status = "PROPOSED";
    const plan = h.path.plans[0]!;
    plan.status = "PROPOSED";
    plan.learnerConfirmedAt = null;
    h.path.plans = [plan];
    h.path.agreement.exchangeType = "ONE_WAY";
    h.path.agreement.teacherId = plan.teacherId;
    h.path.agreement.learnerId = plan.learnerId;
    const tree = h.expand(h.render());
    assert.match(text(tree), /Bạn học/);
    assert.doesNotMatch(text(tree), /Bạn dạy/);
    const detail = elements(tree).find(
      (e) =>
        e.type === "Button" && e.props.children === "Xem và xác nhận lộ trình",
    )!;
    (detail.props.onPress as () => void)();
    assert.deepEqual(h.routes, [`/paths/${h.path.id}/plans/${plan.id}`]);
    assert.equal(h.calls.length, 0);
    assert.equal(
      elements(tree).some((e) => e.props.children === "Tạo lộ trình bạn dạy"),
      false,
    );
  } finally {
    h.cleanup();
  }
});

test("a locked agreement opens its complete Session list without dispatching a command", () => {
  const h = harness(false);
  try {
    h.path.status = "SCHEDULED";
    h.path.lockedVersion = h.path.currentVersion;
    h.path.plans[0]!.sessions = [
      {
        id: fixtureId(80),
        sessionNo: 1,
        startAt: "2030-01-02T10:00:00Z",
        endAt: "2030-01-02T11:00:00Z",
        status: "CONFIRMED",
      },
    ];
    const tree = h.expand(h.render());
    const button = elements(tree).find(
      (element) =>
        element.type === "Button" &&
        element.props.children === "Xem tất cả buổi học",
    )!;
    assert.ok(button);
    (button.props.onPress as () => void)();
    assert.deepEqual(h.routes, [`/paths/${h.path.id}/sessions`]);
    assert.equal(h.calls.length, 0);
  } finally {
    h.cleanup();
  }
});

test("polling a new plan version keeps the editor mounted so its draft can be reviewed", () => {
  const h = harness(true);
  try {
    const plan = h.path.plans.find((item) => item.teacherId === learnerId)!;
    h.params.planId = plan.id;
    const editor = () =>
      elements(h.screen.ApiPlanEditorScreen()).find(
        (item) =>
          typeof item.type === "function" && item.type.name === "PlanForm",
      )!;
    const original = editor();
    assert.ok(original);
    plan.version++;
    const updated = editor();
    assert.equal(
      updated.key,
      original.key,
      "a remote revision must not remount and reset the editor",
    );
  } finally {
    h.cleanup();
  }
});

test("learner confirms the current version without being redirected away from detail", async () => {
  const h = harness(false);
  try {
    const plan = h.path.plans[0]!;
    h.path.status = "PROPOSED";
    plan.status = "PROPOSED";
    plan.learnerConfirmedAt = null;
    const render = () => h.screen.ApiPlanActions({ path: h.path, plan });
    const button = () =>
      elements(render()).find(
        (e) =>
          e.type === "Button" && e.props.children === "Đồng ý lộ trình này",
      )!;
    assert.equal(button().props.disabled, false);
    (button().props.onPress as () => void)();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(h.calls, [{ id: plan.id, version: plan.version }]);
    assert.equal(h.routes.length, 0);
    h.command.uncertain = true;
    assert.equal(button().props.disabled, true);
    plan.learnerConfirmedAt = "2030-01-01T00:00:00Z";
    assert.ok(
      elements(render()).some(
        (e) =>
          e.type === "Button" &&
          e.props.children === "Tiếp tục thỏa thuận lịch học",
      ),
    );
  } finally {
    h.cleanup();
  }
});

test("agreement displays only the current step and accepts terms before any plan exists", async () => {
  const h = harness(false);
  try {
    h.path.status = "PROPOSED";
    h.path.plans = [];
    h.path.agreement.participantAConfirmedAt = null;
    h.path.agreement.participantBConfirmedAt = null;
    const render = () => h.expand(h.render());
    const step = () =>
      elements(render()).find((e) => e.type === "Steps")!.props.current;
    const confirm = () =>
      elements(render()).find(
        (e) => e.type === "Button" && e.props.children === "Đồng ý cách học",
      )!;
    assert.equal(step(), "method");
    assert.equal(
      elements(render()).filter((e) => e.type === "AgreementForm").length,
      0,
    );
    assert.equal(h.calls.length, 0);
    (confirm().props.onPress as () => void)();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(h.calls, [
      { agreementId: h.path.id, version: h.path.currentVersion },
    ]);
    // A command result alone does not fabricate either party's confirmation.
    assert.equal(step(), "method");
    h.path.agreement.participantBConfirmedAt = "2030-01-01T00:00:00Z";
    assert.equal(step(), "method");
    assert.equal(
      elements(render()).some(
        (e) => e.type === "Button" && e.props.children === "Đồng ý cách học",
      ),
      false,
    );
    h.path.agreement.participantAConfirmedAt = "2030-01-01T00:00:00Z";
    assert.equal(step(), "plans");
    assert.equal(
      elements(render()).some(
        (e) => e.type === "Panel" && e.props.title === "Thống nhất cách học",
      ),
      false,
    );
    h.path.currentVersion++;
    h.path.agreement.version++;
    h.path.agreement.participantAConfirmedAt = null;
    h.path.agreement.participantBConfirmedAt = null;
    assert.equal(step(), "method");
    assert.match(text(render()), /cần xem lại/);
    assert.equal(h.routes.length, 0);
  } finally {
    h.cleanup();
  }
});

test("read failures and unknown agreement commands cannot open plan actions", () => {
  const h = harness(false);
  try {
    h.path.status = "PROPOSED";
    h.path.agreement.participantAConfirmedAt = null;
    h.path.agreement.participantBConfirmedAt = null;
    h.query.error = new Error("read failed");
    const render = () => h.expand(h.render());
    const confirm = () =>
      elements(render()).find(
        (e) => e.type === "Button" && e.props.children === "Đồng ý cách học",
      )!;
    assert.equal(confirm().props.disabled, true);
    h.query.error = undefined;
    h.command.uncertain = true;
    assert.equal(confirm().props.disabled, true);
    assert.equal(
      elements(render()).some(
        (e) =>
          e.type === "Button" && e.props.children === "Tạo lộ trình bạn dạy",
      ),
      false,
    );
    assert.ok(
      elements(render()).some(
        (e) =>
          e.type === "Button" && e.props.children === "Kiểm tra trạng thái",
      ),
    );
    assert.equal(h.calls.length, 0);
  } finally {
    h.cleanup();
  }
});

test("direct plan editor links stay closed until both agree, while shared detail remains readable", () => {
  const h = harness(true);
  try {
    h.path.agreement.participantAConfirmedAt = null;
    h.path.agreement.participantBConfirmedAt = null;
    // The editor points at a plan this user teaches, not an ownership rejection.
    h.params.planId = h.path.plans[1]!.id;
    const editor = h.screen.ApiPlanEditorScreen();
    assert.equal(
      elements(editor).some(
        (e) => typeof e.type === "function" && e.type.name === "PlanForm",
      ),
      false,
    );
    assert.ok(
      elements(editor).some(
        (e) =>
          e.type === "EmptyState" &&
          e.props.title === "Cần thống nhất cách học trước",
      ),
    );
    h.params.planId = h.path.plans[0]!.id;
    assert.equal(
      elements(h.render()).filter((e) => e.type === "PlanPanel").length,
      1,
    );
    assert.equal(h.calls.length, 0);
  } finally {
    h.cleanup();
  }
});

test("submitting an edit saves and confirms its returned version without a second approval action", async () => {
  const h = harness(false);
  try {
    h.params.editTerms = "1";
    const form = elements(h.expand(h.render())).find(
      (e) => e.type === "AgreementForm",
    );
    assert.ok(form);
    assert.equal(h.calls.length, 0); // Opening the editor never confirms anything.
    await (form.props.onSubmit as (input: unknown) => Promise<void>)({
      exchangeType: "TWO_WAY",
      totalCreditPerUser: "25.00",
    });
    assert.deepEqual(h.calls, [
      { revisionId: h.path.id, version: h.path.currentVersion },
      { agreementId: h.path.id, version: h.path.currentVersion + 1 },
    ]);
    assert.equal(h.routes.length, 0);
    delete h.params.editTerms;
    h.path.status = "PARTIALLY_CONFIRMED";
    h.path.agreement.participantAConfirmedAt = null;
    const tree = h.expand(h.render());
    assert.equal(
      elements(tree).some(
        (e) =>
          e.type === "Button" &&
          ["Đồng ý cách học", "Kiểm tra cập nhật"].includes(
            String(e.props.children),
          ),
      ),
      false,
    );
    assert.equal(
      elements(tree).some((e) => e.type === "ChatLink"),
      false,
    );
  } finally {
    h.cleanup();
  }
});

test("Chat-origin agreement fallback never opens My Learning while loading or on read failure", () => {
  const h = harness(false);
  try {
    h.query.data = undefined;
    for (const error of [undefined, new Error("read failed")]) {
      h.query.error = error;
      const page = h.render();
      assert.equal(page.props.backBehavior, "history");
      assert.deepEqual(page.props.back, {
        pathname: "/chat/[proposalId]",
        params: { proposalId: h.path.conversationId, mode: "api" },
      });
      assert.equal(h.routes.length, 0);
    }
  } finally {
    h.cleanup();
  }
});

test("plan edit Back targets its detail and saving returns to the existing detail", async () => {
  const h = harness(true);
  try {
    h.params.planId = h.path.plans[1]!.id;
    const page = h.screen.ApiPlanEditorScreen();
    assert.equal(page.props.backBehavior, "history");
    assert.equal(
      page.props.back,
      `/paths/${h.path.id}/plans/${h.params.planId}`,
    );
    const form = elements(page).find(
      (e) => typeof e.type === "function" && e.type.name === "PlanForm",
    );
    assert.ok(form);
    const body = (form.type as (props: unknown) => unknown)(form.props);
    const save = elements(body).find(
      (e) => e.type === "Button" && text(e) === "Lưu và xem lộ trình",
    );
    assert.ok(save);
    (save.props.onPress as () => void)();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(h.navigation, [
      {
        method: "dismissTo",
        href: `/paths/${h.path.id}/plans/${h.params.planId}`,
      },
    ]);
  } finally {
    h.cleanup();
  }
});

test("schedule step distinguishes both directions and blocks proposing while a read fails", () => {
  const h = harness(false);
  try {
    h.query.error = new Error("read failed");
    let tree = h.expand(h.render());
    assert.match(text(tree), /Lịch bạn dạy/);
    assert.match(text(tree), /Lịch bạn học/);
    let propose = elements(tree).find(
      (e) => e.type === "Button" && e.props.children === "Đề xuất lịch tôi dạy",
    )!;
    assert.equal(propose.props.disabled, true);
    (propose.props.onPress as () => void)();
    assert.equal(h.routes.length, 0);
    h.query.error = undefined;
    tree = h.expand(h.render());
    propose = elements(tree).find(
      (e) => e.type === "Button" && e.props.children === "Đề xuất lịch tôi dạy",
    )!;
    (propose.props.onPress as () => void)();
    assert.deepEqual(h.routes, [
      `/paths/${h.path.id}/schedules/${h.path.plans[1]!.id}`,
    ]);
    assert.equal(h.calls.length, 0);
  } finally {
    h.cleanup();
  }
});

test("schedule overview leads to final validation only after both confirm and ONE_WAY has one direction", () => {
  const h = harness(false);
  try {
    h.path.plans = withConfirmedSchedules(h.path).plans;
    let tree = h.expand(h.render());
    assert.ok(
      elements(tree).some((e) => e.props.children === "Xem và chốt lịch học"),
    );
    h.path.plans[0]!.schedule!.participantBConfirmedAt = null;
    tree = h.expand(h.render());
    assert.match(text(tree), /Bạn cần xác nhận/);
    assert.equal(
      elements(tree).some((e) => e.props.children === "Xem và chốt lịch học"),
      false,
    );
    const view = elements(tree).find(
      (e) => e.type === "Button" && e.props.children === "Xem và xác nhận lịch",
    )!;
    (view.props.onPress as () => void)();
    assert.deepEqual(h.routes, [`/paths/${h.path.id}/schedules`]);
    h.path.plans = [h.path.plans[0]!];
    h.path.agreement.exchangeType = "ONE_WAY";
    h.path.agreement.teacherId = h.path.plans[0]!.teacherId;
    h.path.agreement.learnerId = learnerId;
    tree = h.expand(h.render());
    assert.match(text(tree), /Lịch bạn học/);
    assert.doesNotMatch(text(tree), /Lịch bạn dạy/);
    assert.equal(h.calls.length, 0);
  } finally {
    h.cleanup();
  }
});

test("continuing from plan detail returns to an existing agreement rather than pushing another", () => {
  const h = harness(false);
  try {
    const panel = h.screen.ApiPlanActions({
      path: h.path,
      plan: h.path.plans[0],
    });
    const button = elements(panel).find(
      (e) =>
        e.type === "Button" &&
        e.props.children === "Tiếp tục thỏa thuận lịch học",
    );
    assert.ok(button);
    (button.props.onPress as () => void)();
    assert.deepEqual(h.navigation, [
      { method: "dismissTo", href: `/paths/${h.path.id}` },
    ]);
  } finally {
    h.cleanup();
  }
});

test("agreement plan cards offer editing only for the teaching plan and block its handler on a failed read", () => {
  const h = harness(false);
  try {
    h.path.status = "PROPOSED";
    h.path.plans[0]!.learnerConfirmedAt = null;
    const editButtons = () =>
      elements(h.expand(h.render())).filter(
        (e) => e.type === "Button" && e.props.children === "Chỉnh sửa",
      );
    assert.equal(editButtons().length, 1);
    (editButtons()[0]!.props.onPress as () => void)();
    assert.deepEqual(h.routes, [
      `/paths/${h.path.id}/plans/${h.path.plans[1]!.id}/edit`,
    ]);
    h.query.error = new Error("read failed");
    const disabled = editButtons()[0]!;
    assert.equal(disabled.props.disabled, true);
    (disabled.props.onPress as () => void)();
    assert.equal(h.routes.length, 1);
    assert.equal(h.calls.length, 0);
  } finally {
    h.cleanup();
  }
});
