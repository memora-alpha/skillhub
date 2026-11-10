import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";
import { createPathChangesApi } from "../src/features/learning-paths/api/path-changes-api";
import {
  terminationFixture,
  settlementFixture,
  terminationQuoteFixture,
} from "./fixtures/path-changes-data";
import type { SettlementStatus } from "../src/features/learning-paths/api/path-changes-contract";
import { fixtureId } from "./fixtures/learning-requests-data";
import { agreementPath } from "./fixtures/learning-agreement";

type Element = {
  type: string | ((props: Record<string, unknown>) => Element);
  props: Record<string, unknown>;
};
function nodes(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...nodes(element.props.children)];
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (value && typeof value === "object" && "props" in value)
    return text((value as Element).props.children);
  return value === null || value === undefined || value === false
    ? ""
    : String(value);
}
function harness(
  component:
    | "termination-create-form"
    | "termination-request-card"
    | "termination-decision"
    | "termination-credit-preview"
    | "termination-requests"
    | "termination-history-item"
    | "path-settlement-panel"
    | "settlement-consent-form",
) {
  const local = createRequire(
    new URL(
      `../src/features/learning-paths/components/${component}.tsx`,
      import.meta.url,
    ),
  );
  const filename = local.resolve(`./${component}.tsx`);
  const dialogFilename = local.resolve("./termination-confirm-dialog.tsx");
  const actionDialogFilename = local.resolve("./termination-action-dialog.tsx");
  let index = 0;
  const states: unknown[] = [];
  const request = terminationFixture();
  const preflightPath = agreementPath();
  preflightPath.id = request.pathId;
  preflightPath.status = "ACTIVE";
  preflightPath.lockedVersion = preflightPath.currentVersion;
  const quote = terminationQuoteFixture();
  let current = true;
  let viewerId = fixtureId(1);
  let fail = false;
  let reads = 0;
  let refreshes = 0;
  const consentReceipt = {
    pathId: request.pathId,
    approvedAt: request.createdAt,
    bothApproved: false,
    settlement: { outcome: "WAITING" },
  };
  const calls: { url: string; body: unknown; key?: string; method?: string }[] =
    [];
  const api = createPathChangesApi(async (url, options) => {
    calls.push({
      url,
      body: options?.body,
      key: options?.idempotencyKey,
      method: options?.method,
    });
    if (fail) throw new AppError("network");
    if (url.endsWith("settlement-status")) return query.data;
    if (url.endsWith("settlement-consent")) return consentReceipt;
    return request;
  });
  let previous: ((key: string) => Promise<unknown>) | undefined;
  let busy = false;
  const command = {
    pending: false,
    uncertain: false,
    error: undefined as unknown,
    run: async (
      _fingerprint: string,
      send: (key: string) => Promise<unknown>,
    ) => {
      if (busy || !current) return;
      busy = true;
      command.pending = true;
      previous = send;
      try {
        return await send("retained-key");
      } catch (error) {
        command.error = error;
        command.uncertain = true;
      } finally {
        busy = false;
        command.pending = false;
      }
    },
    retry: async () => previous && command.run("same", previous),
  };
  const query = {
    data: settlementFixture() as SettlementStatus,
    isLoading: false,
    isFetching: false,
    error: undefined as unknown,
    refetch: () => {
      reads++;
    },
  };
  const jsx = (type: Element["type"], props: Element["props"]) => ({
    type,
    props,
  });
  const mocks = {
    react: {
      useRef: (initial: unknown) => {
        const slot = index++;
        if (!(slot in states)) states[slot] = { current: initial };
        return states[slot];
      },
      useEffect: () => {},
      useState: (initial: unknown) => {
        const slot = index++;
        if (!(slot in states)) states[slot] = initial;
        return [
          states[slot],
          (next: unknown) => {
            states[slot] =
              typeof next === "function" ? next(states[slot]) : next;
          },
        ];
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": {
      Pressable: "Pressable",
      View: "View",
      Text: "Text",
      Modal: "Modal",
      ScrollView: "ScrollView",
      Keyboard: { dismiss() {} },
      StyleSheet: { create: (styles: unknown) => styles },
    },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/SafeArea": { SafeAreaView: "SafeAreaView" },
    "@/components/Button": { Button: "Button" },
    "@/components/Input": { Input: "Input" },
    "@/components/EmptyState": { EmptyState: "Empty" },
    "@/components/feature-page": { Copy: "Copy", RouteButton: "RouteButton" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/components/learning-flow": { FlowSection: "Section" },
    "@/features/connections": {
      useConnections: () => ({
        userId: viewerId,
        enabled: true,
        isCurrent: () => current,
      }),
      useConnectionCommand: () => command,
    },
    "../hooks/use-path-changes": {
      usePathChangesApi: () => ({ ...api, list: async () => [] }),
      usePathSettlement: () => query,
    },
    "../hooks/use-learning-paths-api": {
      useLearningPathsApi: () => ({ detail: async () => preflightPath }),
    },
    "../hooks/use-termination-quote": {
      useTerminationQuote: () => ({ ...query, data: quote }),
    },
    "./termination-feedback": { TerminationFeedback: "Feedback" },
    "./PathReadFeedback": { PathReadFeedback: "ReadFeedback" },
  };
  const contexts = Object.entries(mocks).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  if (component === "termination-requests") {
    contexts.push(
      mock.module(pathToFileURL(local.resolve("./termination-request-card")), {
        namedExports: { TerminationRequestCard: "RequestCard" },
      }),
    );
    contexts.push(
      mock.module(pathToFileURL(local.resolve("./termination-history-item")), {
        namedExports: { TerminationHistoryItem: "HistoryItem" },
      }),
    );
  }
  delete local.cache[filename];
  delete local.cache[dialogFilename];
  delete local.cache[actionDialogFilename];
  const module = local(filename) as Record<
    string,
    (props: Record<string, unknown>) => Element
  >;
  const exportName = {
    "termination-create-form": "TerminationCreateForm",
    "termination-request-card": "TerminationRequestCard",
    "termination-decision": "TerminationDecision",
    "termination-credit-preview": "TerminationQuoteDetails",
    "termination-requests": "TerminationRequests",
    "termination-history-item": "TerminationHistoryItem",
    "path-settlement-panel": "PathSettlementPanel",
    "settlement-consent-form": "SettlementConsentForm",
  }[component];
  let blocked = false;
  function expandDialog(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(expandDialog);
    if (!value || typeof value !== "object" || !("props" in value))
      return value;
    const element = value as Element;
    if (
      typeof element.type === "function" &&
      [
        "TerminationConfirmDialog",
        "TerminationActionDialog",
        "TerminationRequestMetadata",
        "TerminationCreditAmounts",
        "TerminationStatusHeader",
        "SettlementRelatedItems",
      ].includes(element.type.name)
    )
      return expandDialog(element.type(element.props));
    return {
      ...element,
      props: {
        ...element.props,
        children: expandDialog(element.props.children),
      },
    };
  }
  return {
    request,
    preflightPath,
    quote,
    calls,
    command,
    query,
    consentReceipt,
    setCurrent(value: boolean) {
      current = value;
    },
    setViewer(value: string) {
      viewerId = value;
    },
    setFail(value: boolean) {
      fail = value;
    },
    setBlocked(value: boolean) {
      blocked = value;
    },
    render(overrides: Record<string, unknown> = {}, exported = exportName) {
      index = 0;
      return expandDialog(
        module[exported]!({
          pathId: request.pathId,
          request,
          quote,
          snapshot: query.data,
          blocked,
          refresh: () => {
            refreshes++;
          },
          ...overrides,
        }),
      ) as Element;
    },
    counts: () => ({ reads, refreshes }),
    close() {
      delete local.cache[filename];
      delete local.cache[dialogFilename];
      delete local.cache[actionDialogFilename];
      contexts.reverse().forEach((context) => context.restore());
    },
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("withdrawn history identifies the requester and uses server send/close timestamps", () => {
  const h = harness("termination-request-card");
  try {
    h.request.status = "WITHDRAWN";
    h.request.closedAt = "2030-01-03T10:30:00Z";
    for (const viewer of [h.request.requesterId, fixtureId(2)]) {
      h.setViewer(viewer);
      const tree = h.render();
      assert.match(
        text(tree),
        viewer === h.request.requesterId ? /Bạn\s+đã rút/ : /Đối tác\s+đã rút/,
      );
      assert.match(text(tree), /Gửi lúc/);
      assert.match(text(tree), /Rút lúc/);
      assert.match(text(tree), /03\/01\/2030/);
      assert.match(text(tree), /không còn hiệu lực/);
      assert.doesNotMatch(text(tree), /Hạn phản hồi|đã gửi yêu cầu hủy/);
      assert.equal(
        nodes(tree).some((node) => node.type === "Button"),
        false,
      );
    }
    h.request.closedAt = null;
    assert.match(text(h.render()), /chưa có thông tin thời gian/);
    assert.equal(h.calls.length, 0);
  } finally {
    h.close();
  }
});

test("history rows reveal full details individually, keep server timestamps and never send a command", () => {
  const h = harness("termination-history-item");
  try {
    h.request.status = "WITHDRAWN";
    h.request.closedAt = "2030-01-03T10:30:00Z";
    let tree = h.render();
    assert.match(text(tree), /Đã rút yêu cầu/);
    assert.match(
      text(tree),
      /Rút lúc 17:30 03\/01\/2030|Rút lúc .*03\/01\/2030/,
    );
    assert.ok(
      nodes(tree).some(
        (node) => node.type === "Text" && node.props.numberOfLines === 2,
      ),
    );
    const toggle = () =>
      nodes(tree).find((node) => node.type === "Pressable")!.props;
    assert.deepEqual(toggle().accessibilityState, { expanded: false });
    (toggle().onPress as () => void)();
    tree = h.render();
    assert.match(text(tree), /Gửi lúc/);
    assert.match(text(tree), /không còn hiệu lực/);
    assert.equal(
      nodes(tree).some((node) => node.props.numberOfLines === 2),
      false,
    );
    (toggle().onPress as () => void)();
    tree = h.render();
    assert.deepEqual(toggle().accessibilityState, { expanded: false });
    h.request.closedAt = null;
    assert.match(text(h.render()), /Gửi lúc/);
    assert.equal(h.calls.length, 0);
  } finally {
    h.close();
  }
  const selected = harness("termination-history-item");
  try {
    selected.request.status = "EXPIRED";
    const tree = selected.render({ defaultExpanded: true, selected: true });
    assert.match(text(tree), /Từ thông báo/);
    assert.match(text(tree), /Hết hạn lúc/);
    assert.deepEqual(
      nodes(tree).find((node) => node.type === "Pressable")!.props
        .accessibilityState,
      { expanded: true },
    );
  } finally {
    selected.close();
  }
});

test("cancellation list keeps the active request before history, opens notification targets and retains withdrawal receipts", () => {
  const h = harness("termination-requests");
  try {
    const old = terminationFixture({
      id: fixtureId(50),
      status: "WITHDRAWN",
      version: 2,
    });
    const requests = [h.request, old];
    const render = (selectedId?: string) =>
      h.render({
        requests,
        selectedId,
        beforeHistory: {
          type: "CreditPreview",
          props: { children: "Credit dự kiến" },
        },
      });
    const cards = (tree: Element) =>
      nodes(tree).filter(
        (node) => node.type === "RequestCard" || node.type === "HistoryItem",
      );
    let tree = render();
    assert.match(
      text(tree),
      /Yêu cầu hiện tại[\s\S]*Credit dự kiến[\s\S]*Lịch sử yêu cầu hủy/,
    );
    assert.equal(cards(tree).length, 1);
    assert.match(text(tree), /Lịch sử yêu cầu hủy/);
    button(tree, "Xem lịch sử (1)").onPress();
    tree = render();
    assert.deepEqual(
      cards(tree).map((card) => (card.props.request as typeof old).id),
      [h.request.id, old.id],
    );
    button(tree, "Thu gọn lịch sử").onPress();
    tree = render(old.id);
    assert.equal(cards(tree).length, 2);
    assert.ok(
      cards(tree).some(
        (node) =>
          node.type === "HistoryItem" &&
          node.props.selected === true &&
          node.props.defaultExpanded === true,
      ),
    );
    const receipt = {
      ...h.request,
      status: "WITHDRAWN" as const,
      version: 2,
      closedAt: "2030-01-02T00:00:00Z",
    };
    (cards(tree)[0]!.props.onUpdated as (value: typeof receipt) => void)(
      receipt,
    );
    tree = render(old.id); // the GET still has the old PENDING row
    assert.doesNotMatch(text(tree), /Yêu cầu hiện tại/);
    assert.equal(
      (cards(tree)[0]!.props.request as typeof receipt).status,
      "WITHDRAWN",
    );
    assert.equal(h.calls.length, 0);
  } finally {
    h.close();
  }
});

function button(tree: Element, label: string) {
  const found = nodes(tree).find(
    (node) =>
      (node.type === "Button" && text(node) === label) ||
      (node.type === "Pressable" && node.props.accessibilityLabel === label),
  );
  assert.ok(found, `Missing button: ${label}`);
  assert.equal(typeof found.props.onPress, "function");
  return found.props as Element["props"] & { onPress: () => void };
}
function input(tree: Element) {
  const found = nodes(tree).find((node) => node.type === "Input");
  assert.ok(found);
  assert.equal(typeof found.props.onChangeText, "function");
  return found.props as Element["props"] & {
    onChangeText: (value: string) => void;
  };
}

test("create requires review, preserves the original reason on uncertain failure and explicitly retries the same key", async () => {
  const h = harness("termination-create-form");
  try {
    assert.equal(button(h.render(), "Gửi yêu cầu hủy").disabled, true);
    input(h.render()).onChangeText("Lý do đã xem lại");
    button(h.render(), "Gửi yêu cầu hủy").onPress();
    assert.equal(h.calls.length, 0);
    assert.ok(
      nodes(h.render()).some((node) => node.props.role === "alertdialog"),
    );
    button(h.render(), "Quay lại").onPress();
    assert.equal(
      nodes(h.render()).some((node) => node.type === "Modal"),
      false,
    );
    assert.equal(h.calls.length, 0);
    assert.equal(
      nodes(h.render()).find((node) => node.type === "Input")!.props.value,
      "Lý do đã xem lại",
    );
    button(h.render(), "Gửi yêu cầu hủy").onPress();
    assert.match(text(h.render()), /Lý do đã xem lại/);
    h.setFail(true);
    button(h.render(), "Xác nhận gửi yêu cầu").onPress();
    await tick();
    const failed = h.render();
    assert.equal(
      nodes(failed).find((node) => node.type === "Input")!.props.editable,
      false,
    );
    assert.equal(button(failed, "Xác nhận gửi yêu cầu").disabled, true);
    const modal = nodes(failed).find((node) => node.type === "Modal")!;
    (modal.props.onRequestClose as () => void)();
    assert.ok(
      nodes(h.render()).some((node) => node.type === "Modal"),
      "uncertain intent stays in its confirmation dialog",
    );
    assert.equal(h.calls.length, 1);
    h.render(); // A render/focus refresh never replays a mutation.
    assert.equal(h.calls.length, 1);
    h.setFail(false);
    button(h.render(), "Kiểm tra lại lần gửi trước").onPress();
    await tick();
    assert.deepEqual(h.calls[0], h.calls[1]);
    assert.equal(h.calls[1]?.key, "retained-key");
    assert.equal(h.counts().refreshes, 1);
    assert.match(text(h.render()), /Đã gửi yêu cầu/);
    assert.equal(button(h.render(), "Đã gửi yêu cầu hủy").disabled, true);
    assert.equal(
      nodes(h.render()).some((node) => node.type === "Modal"),
      false,
    );
  } finally {
    h.close();
  }
});
test("busy, stale reads and a changed login session block creation and suppress late success", async () => {
  const h = harness("termination-create-form");
  try {
    input(h.render()).onChangeText("Không tiếp tục học");
    button(h.render(), "Gửi yêu cầu hủy").onPress();
    h.setBlocked(true);
    button(h.render(), "Xác nhận gửi yêu cầu").onPress();
    assert.equal(h.calls.length, 0);
    h.setBlocked(false);
    h.command.pending = true;
    assert.equal(button(h.render(), "Đang gửi...").disabled, true);
    h.command.pending = false;
    button(h.render(), "Xác nhận gửi yêu cầu").onPress();
    h.setCurrent(false);
    await tick();
    assert.equal(h.calls.length, 0);
    assert.equal(h.counts().refreshes, 0);
    assert.doesNotMatch(text(h.render()), /Đã gửi yêu cầu/);
  } finally {
    h.close();
  }
});

test("confirming an old cancellation dialog rechecks completion and sends no new request", async () => {
  const h = harness("termination-create-form");
  try {
    input(h.render()).onChangeText("Không tiếp tục học");
    button(h.render(), "Gửi yêu cầu hủy").onPress();
    h.preflightPath.plans[0]!.sessions = [
      {
        id: fixtureId(75),
        sessionNo: 1,
        status: "COMPLETED",
        startAt: "2030-01-02T10:00:00Z",
        endAt: "2030-01-02T11:00:00Z",
      },
    ];
    button(h.render(), "Xác nhận gửi yêu cầu").onPress();
    await tick();
    assert.equal(h.calls.length, 0);
    assert.equal(h.counts().refreshes, 1);
    const error = nodes(h.render()).find(
      (node) =>
        node.type === "Feedback" && node.props.error instanceof AppError,
    )?.props.error as AppError;
    assert.equal(error.code, "TERMINATION_USE_FINAL_SETTLEMENT");
    assert.equal(
      nodes(h.render()).find((node) => node.type === "Input")?.props.value,
      "Không tiếp tục học",
    );
  } finally {
    h.close();
  }
});

test("rapid confirmation taps perform one cancellation command after preflight", async () => {
  const h = harness("termination-create-form");
  try {
    input(h.render()).onChangeText("Không tiếp tục học");
    button(h.render(), "Gửi yêu cầu hủy").onPress();
    const confirm = button(h.render(), "Xác nhận gửi yêu cầu");
    confirm.onPress();
    confirm.onPress();
    await tick();
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0]?.method, "POST");
    assert.equal(h.counts().refreshes, 1);
  } finally {
    h.close();
  }
});
test("partner decline submits expected version only after review, and stale/closed requests expose no actions", async () => {
  const h = harness("termination-request-card");
  try {
    h.setViewer(fixtureId(2));
    assert.equal(
      nodes(h.render()).some(
        (node) => node.type === "Button" && text(node) === "Nhờ hỗ trợ",
      ),
      false,
    );
    button(h.render(), "Không đồng ý").onPress();
    assert.equal(h.calls.length, 0);
    assert.ok(
      nodes(h.render()).some((node) => node.props.role === "alertdialog"),
    );
    assert.match(text(h.render()), /chuyển cho nhân viên xem xét/);
    button(h.render(), "Xác nhận không đồng ý").onPress();
    h.request.status = "STAFF_REVIEW";
    h.request.accepted = false;
    await tick();
    assert.deepEqual(h.calls[0]?.body, { expectedVersion: 1, accept: false });
    assert.match(h.calls[0]!.url, /\/response$/);
    h.request.status = "EXPIRED";
    assert.equal(
      nodes(h.render()).filter((node) => node.type === "Button").length,
      0,
    );
  } finally {
    h.close();
  }
});
test("disputes and policy block Credit settlement without blocking cancellation approval", () => {
  const h = harness("termination-request-card");
  try {
    for (const [dispute, policy] of [
      [true, true],
      [true, false],
      [false, true],
    ]) {
      h.request.blockedByDispute = dispute!;
      h.request.awaitingPolicy = policy!;
      h.setViewer(fixtureId(1));
      const warnings = nodes(h.render()).filter(
        (node) => node.type === "Notice" && node.props.tone === "warning",
      );
      assert.equal(warnings.length, 1);
      assert.match(text(warnings[0]), /Credit chưa thể quyết toán: chờ/);
      assert.match(
        text(warnings[0]),
        /Đã gửi yêu cầu hủy, đang chờ đối tác đồng ý/,
      );
      assert.doesNotMatch(
        text(warnings[0]),
        /lộ trình chưa hủy|thực hiện quyết định dừng/,
      );
      assert.equal(
        text(warnings[0]).includes("giải quyết tranh chấp"),
        dispute,
      );
      assert.equal(
        text(warnings[0]).includes("duyệt chính sách Credit"),
        policy,
      );
      h.setViewer(fixtureId(2));
      assert.match(
        text(h.render()),
        /Đối tác đã gửi yêu cầu hủy, đang chờ bạn phản hồi/,
      );
      assert.equal(button(h.render(), "Đồng ý hủy").disabled, false);
    }
    h.request.blockedByDispute = false;
    h.request.awaitingPolicy = false;
    assert.equal(
      nodes(h.render()).filter(
        (node) => node.type === "Notice" && node.props.tone === "warning",
      ).length,
      0,
    );
    h.request.blockedByDispute = true;
    h.request.status = "STAFF_REVIEW";
    assert.match(text(h.render()), /Yêu cầu hủy đang chờ nhân viên xem xét/);
    assert.doesNotMatch(
      text(h.render()),
      /đang chờ đối tác đồng ý|đang chờ bạn phản hồi/,
    );
    h.request.status = "ACCEPTED";
    assert.match(text(h.render()), /đã được đồng ý, đang chờ cập nhật kết quả/);
  } finally {
    h.close();
  }
});

test("an approved cancellation distinguishes stopped obligations from Credit waiting on blockers", () => {
  const h = harness("termination-request-card");
  try {
    h.request.status = "ACCEPTED";
    h.request.approvedAt = h.request.createdAt;
    h.request.blockedByDispute = true;
    const tree = h.render();
    assert.match(text(tree), /Đã dừng các buổi tương lai/);
    assert.match(text(tree), /Đã duyệt hủy\.\s+Credit chưa thể quyết toán/);
    assert.doesNotMatch(text(tree), /lộ trình chưa hủy|Chờ Admin/);
    assert.equal(
      nodes(tree).filter((node) => node.type === "Button").length,
      0,
    );
    assert.equal(h.calls.length, 0);
  } finally {
    h.close();
  }
});

test("Credit preview expands explicitly and never sends a mutation", () => {
  const h = harness("termination-credit-preview");
  try {
    const render = () => h.render({}, "TerminationCreditPreview");
    let tree = render();
    assert.doesNotMatch(text(tree), /Tạm tính|96.00/);
    assert.deepEqual(button(tree, "Xem Credit dự kiến").accessibilityState, {
      expanded: false,
    });
    button(tree, "Xem Credit dự kiến").onPress();
    tree = render();
    // The real details component stays mounted only while expanded.
    assert.ok(
      nodes(tree).some(
        (node) =>
          typeof node.type === "function" &&
          node.type.name === "TerminationQuoteDetails",
      ),
    );
    button(tree, "Thu gọn Credit dự kiến").onPress();
    assert.deepEqual(
      button(render(), "Xem Credit dự kiến").accessibilityState,
      { expanded: false },
    );
    assert.equal(h.calls.length, 0);
  } finally {
    h.close();
  }
});

test("quote details label both owners, keep exact amounts and never send a mutation", () => {
  const h = harness("termination-credit-preview");
  try {
    h.quote.allocations.push({
      ...h.quote.allocations[0]!,
      allocationId: fixtureId(41),
      userId: fixtureId(2),
      refund: "9007199254740993.01",
      compensationCredit: "3.01",
      counterpartyPayment: "3.01",
    });
    h.quote.status = "BLOCKED";
    h.quote.reasonCodes = ["TERMINATION_SESSION_RULING_REQUIRED"];
    const tree = h.render();
    const titles = nodes(tree)
      .filter((node) => node.props.accessibilityRole === "header")
      .map((node) => text(node));
    assert.deepEqual(titles, ["Khoản của bạn", "Khoản của đối tác"]);
    assert.match(text(tree), /Hoàn lại:\s+60.00\s+CR/);
    assert.match(text(tree), /9007199254740993.01/);
    assert.match(text(tree), /3.01\s+CR bồi hoàn/);
    assert.match(text(tree), /Chờ kết luận/);
    assert.match(text(tree), /Tạm tính/);
    assert.equal(h.calls.length, 0);
  } finally {
    h.close();
  }
});

test("staff escalation asks for a note only when chosen and still validates it before sending", async () => {
  const h = harness("termination-request-card");
  try {
    assert.equal(
      nodes(h.render()).some((node) => node.type === "Input"),
      false,
    );
    button(h.render(), "Nhờ hỗ trợ").onPress();
    assert.equal(input(h.render()).editable, true);
    assert.equal(button(h.render(), "Gửi yêu cầu hỗ trợ").disabled, true);
    button(h.render(), "Gửi yêu cầu hỗ trợ").onPress();
    assert.equal(h.calls.length, 0);
    input(h.render()).onChangeText("Cần hỗ trợ xử lý");
    button(h.render(), "Gửi yêu cầu hỗ trợ").onPress();
    h.request.status = "STAFF_REVIEW";
    await tick();
    assert.deepEqual(h.calls[0]?.body, {
      expectedVersion: 1,
      reason: "Cần hỗ trợ xử lý",
    });
    assert.match(h.calls[0]!.url, /\/escalate$/);
    assert.equal(
      nodes(h.render()).some((node) => node.type === "Modal"),
      false,
    );
    assert.equal(
      nodes(h.render()).some(
        (node) => node.type === "Button" && text(node) === "Nhờ hỗ trợ",
      ),
      false,
    );
    assert.match(text(h.render()), /Yêu cầu đã được gửi đến nhân viên hỗ trợ/);
  } finally {
    h.close();
  }
});

test("an uncertain partner response keeps its modal and immutable note until explicit retry", async () => {
  const h = harness("termination-request-card");
  try {
    h.setViewer(fixtureId(2));
    button(h.render(), "Không đồng ý").onPress();
    input(h.render()).onChangeText("Cần trao đổi lại lý do hủy");
    h.setFail(true);
    button(h.render(), "Xác nhận không đồng ý").onPress();
    await tick();
    assert.equal(input(h.render()).editable, false);
    const modal = nodes(h.render()).find((node) => node.type === "Modal")!;
    (modal.props.onRequestClose as () => void)();
    assert.ok(nodes(h.render()).some((node) => node.type === "Modal"));
    h.render();
    assert.equal(h.calls.length, 1);
    h.setFail(false);
    button(h.render(), "Kiểm tra lại lần gửi trước").onPress();
    h.request.status = "STAFF_REVIEW";
    h.request.accepted = false;
    await tick();
    assert.deepEqual(h.calls[0], h.calls[1]);
    assert.equal(
      nodes(h.render()).some((node) => node.type === "Modal"),
      false,
    );
    assert.equal(h.counts().refreshes, 1);
  } finally {
    h.close();
  }
});

test("accepting shows the server's accepted state immediately and never exposes escalation after agreement", async () => {
  const h = harness("termination-request-card");
  try {
    h.setViewer(fixtureId(2));
    button(h.render(), "Đồng ý hủy").onPress();
    assert.equal(h.calls.length, 0);
    assert.equal(
      nodes(h.render()).some((node) => node.type === "Input"),
      false,
    );
    button(h.render(), "Xác nhận đồng ý").onPress();
    h.request.status = "ACCEPTED";
    h.request.accepted = true;
    h.request.approvedAt = h.request.createdAt;
    h.request.resolution = {
      approvalDigest: "a".repeat(64),
      reason: "Both participants agreed to terminate",
      approvedAt: h.request.createdAt,
    };
    await tick();
    assert.deepEqual(h.calls[0]?.body, { expectedVersion: 1, accept: true });
    assert.equal(
      nodes(h.render()).some((node) => node.type === "Modal"),
      false,
    );
    assert.match(text(h.render()), /Đã dừng các buổi tương lai/);
    assert.equal(
      nodes(h.render()).filter((node) => node.type === "Button").length,
      0,
    );
    h.setViewer(h.request.requesterId);
    assert.equal(
      nodes(h.render()).some(
        (node) => node.type === "Button" && text(node) === "Nhờ hỗ trợ",
      ),
      false,
    );
    assert.equal(
      nodes(h.render()).filter((node) => node.type === "Button").length,
      0,
    );
    assert.equal(h.calls.length, 1);
  } finally {
    h.close();
  }
});

test("the decision shows exact server amounts without attributing both held allocations to the viewer", () => {
  const h = harness("termination-decision");
  try {
    h.request.status = "APPLIED";
    h.request.resolution = {
      policyReference: "approved-policy",
      reason: "Quyết định hợp lệ",
      allocations: [
        {
          allocationId: fixtureId(40),
          refund: "7.01",
          counterpartyPayment: "2.09",
          platformFee: "0.90",
        },
        {
          allocationId: fixtureId(41),
          refund: "4.01",
          counterpartyPayment: "3.00",
          platformFee: "0.99",
        },
      ],
    };
    const content = text(h.render());
    for (const amount of ["7.01", "2.09", "0.90", "4.01", "3.00", "0.99"])
      assert.ok(content.includes(amount));
    assert.match(content, /chủ khoản/);
    assert.doesNotMatch(content, /96%|4%|Bạn được hoàn/);
  } finally {
    h.close();
  }
});
test("completion summary retains financial blockers on read failure and has no manual settlement button", () => {
  const h = harness("path-settlement-panel");
  try {
    h.query.error = new AppError("network");
    const tree = h.render();
    assert.match(text(tree), /chờ xử lý yêu cầu hủy/);
    assert.equal(
      nodes(tree).find(
        (node) =>
          node.type === "RouteButton" && node.props.href === "/wallet/history",
      )?.props.children,
      undefined,
    );
    assert.equal(
      nodes(tree).some((node) => node.type === "Button"),
      false,
    );
    const feedback = nodes(tree).find((node) => node.type === "ReadFeedback");
    assert.ok(feedback);
    (feedback.props.query as { refetch: () => void }).refetch();
    assert.equal(h.counts().reads, 1);
    assert.equal(h.calls.length, 0);
    h.query.data.status = "TERMINATED";
    assert.match(text(h.render()), /Lộ trình đã hủy/);
    h.query.data.status = "RETRYING";
    assert.match(text(h.render()), /đang tự thử lại quyết toán/);
    assert.ok(
      nodes(h.render()).some(
        (node) => node.type === "Notice" && node.props.tone === "warning",
      ),
    );
    h.query.data.status = "WAITING_DISPUTE";
    assert.match(text(h.render()), /tranh chấp/);
    assert.equal(
      nodes(h.render()).some(
        (node) => node.props.href === `/paths/${h.query.data.pathId}/cases`,
      ),
      false,
    );
    h.query.data.status = "SETTLED";
    assert.ok(
      nodes(h.render()).some((node) => node.props.href === "/wallet/history"),
    );
    assert.match(text(h.render()), /Lộ trình đã hoàn thành/);
  } finally {
    h.close();
  }
});

test("saved early consent never overrides dispute, termination or review blockers", () => {
  const h = harness("path-settlement-panel");
  try {
    for (const status of [
      "WAITING_DISPUTE",
      "WAITING_TERMINATION",
      "NEEDS_REVIEW",
      "RETRYING",
    ] as const) {
      for (const partnerApprovedAt of [null, "2030-01-01T00:00:00Z"]) {
        h.query.data = {
          ...settlementFixture(status),
          immediateSettlement: {
            ownApprovedAt: "2030-01-01T00:00:00Z",
            partnerApprovedAt,
            canApprove: false,
          },
        };
        const tree = h.render();
        assert.match(text(tree), /Đã ghi nhận đồng ý quyết toán sớm/);
        assert.doesNotMatch(
          text(tree),
          /Chờ đối tác hoặc hết thời gian chờ|Cả hai đã đồng ý · Đang xử lý/,
        );
        assert.ok(nodes(tree).some((node) => node.type === "Notice"));
      }
    }
    for (const status of ["WAITING_DISPUTE_WINDOW", "READY"] as const) {
      h.query.data = {
        ...settlementFixture(status),
        immediateSettlement: {
          ownApprovedAt: "2030-01-01T00:00:00Z",
          partnerApprovedAt: null,
          canApprove: false,
        },
      };
      assert.match(text(h.render()), /Chờ đối tác hoặc hết thời gian chờ/);
    }
    for (const status of ["TERMINATED", "SETTLED"] as const) {
      h.query.data = {
        ...settlementFixture(status),
        immediateSettlement: {
          ownApprovedAt: "2030-01-01T00:00:00Z",
          partnerApprovedAt: "2030-01-01T00:00:00Z",
          canApprove: false,
        },
      };
      assert.doesNotMatch(
        text(h.render()),
        /Chờ đối tác|Đã ghi nhận đồng ý|Đang xử lý quyết toán/,
      );
    }
    assert.equal(h.calls.length, 0);
  } finally {
    h.close();
  }
});

function consentSnapshot(): SettlementStatus {
  return {
    ...settlementFixture("WAITING_DISPUTE_WINDOW"),
    pathVersion: 3,
    autoSettlementAt: "2030-01-03T00:00:00Z",
    immediateSettlement: {
      ownApprovedAt: null,
      partnerApprovedAt: null,
      canApprove: true,
    },
  };
}

test("early settlement requires a separate review and explicit financial consent, with no POST on render", async () => {
  const h = harness("settlement-consent-form");
  try {
    h.query.data = consentSnapshot();
    button(h.render(), "Đồng ý quyết toán sớm").onPress();
    assert.equal(h.calls.length, 0);
    button(h.render(), "Để sau").onPress();
    assert.equal(
      nodes(h.render()).some((node) => node.type === "Modal"),
      false,
    );
    assert.equal(h.calls.length, 0);
    button(h.render(), "Đồng ý quyết toán sớm").onPress();
    assert.match(text(h.render()), /Bỏ thời gian chờ còn lại/);
    assert.ok(
      nodes(h.render()).some(
        (node) => node.props.role === "alertdialog" && node.props["aria-modal"],
      ),
    );
    assert.ok(
      nodes(h.render()).some(
        (node) =>
          node.type === "Text" &&
          text(node).includes("không tự hoàn lại Credit"),
      ),
    );
    button(h.render(), "Xác nhận đồng ý").onPress();
    await tick();
    assert.deepEqual(
      h.calls.map((call) => call.method ?? "GET"),
      ["GET", "POST"],
    );
    assert.deepEqual(h.calls[1]?.body, { expectedVersion: 3 });
    assert.equal(h.counts().refreshes, 1);
    assert.doesNotMatch(text(h.render()), /Đã quyết toán\./);
  } finally {
    h.close();
  }
});
test("an uncertain financial consent stays blocked until an explicit retry/read, and RETRYING is not success", async () => {
  const h = harness("settlement-consent-form");
  try {
    h.query.data = consentSnapshot();
    h.setFail(true);
    button(h.render(), "Đồng ý quyết toán sớm").onPress();
    button(h.render(), "Xác nhận đồng ý").onPress();
    await tick();
    assert.equal(button(h.render(), "Xác nhận đồng ý").disabled, true);
    const count = h.calls.length;
    h.render();
    assert.equal(h.calls.length, count);
    h.setFail(false);
    h.consentReceipt.settlement.outcome = "RETRYING";
    button(h.render(), "Kiểm tra lại lần đồng ý trước").onPress();
    await tick();
    assert.match(text(h.render()), /chưa xác nhận Credit đã chuyển/);
    assert.equal(h.calls.filter((call) => call.method === "POST").length, 1);
  } finally {
    h.close();
  }
});
test("fresh-read errors block early consent, and changed login suppresses late UI success", async () => {
  const h = harness("settlement-consent-form");
  try {
    h.query.data = consentSnapshot();
    button(h.render(), "Đồng ý quyết toán sớm").onPress();
    h.setBlocked(true);
    button(h.render(), "Xác nhận đồng ý").onPress();
    assert.equal(h.calls.length, 0);
    h.setBlocked(false);
    button(h.render(), "Xác nhận đồng ý").onPress();
    h.setCurrent(false);
    await tick();
    assert.equal(h.counts().refreshes, 0);
    assert.doesNotMatch(
      text(h.render()),
      /Đang cập nhật trạng thái quyết toán/,
    );
  } finally {
    h.close();
  }
});
test("settlement panel shows each consent and hides approval during dispute, after own approval and after settlement", () => {
  const h = harness("path-settlement-panel");
  try {
    h.query.data = consentSnapshot();
    const hasForm = () =>
      nodes(h.render()).some((node) => node.props.snapshot === h.query.data);
    assert.equal(hasForm(), true);
    assert.match(text(h.render()), /Dự kiến/);
    h.query.data.immediateSettlement!.ownApprovedAt = "2030-01-01T00:00:00Z";
    assert.equal(hasForm(), false);
    assert.match(text(h.render()), /Chờ đối tác/);
    h.query.data = { ...consentSnapshot(), status: "WAITING_DISPUTE" };
    assert.equal(hasForm(), false);
    h.query.data = consentSnapshot(); // A new explicit approval is available after a report cleared old consents.
    assert.equal(hasForm(), true);
    h.query.data = { ...consentSnapshot(), status: "SETTLED" };
    assert.equal(hasForm(), false);
  } finally {
    h.close();
  }
});
