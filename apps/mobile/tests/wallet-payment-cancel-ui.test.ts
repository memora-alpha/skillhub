import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { PaymentCancelAction } from "../src/features/wallet/components/payment-cancel-action";
import type { PaymentCancelDialog } from "../src/features/wallet/components/payment-cancel-dialog";
import type { SimplePaymentStatus } from "../src/features/wallet/components/simple-payment-status";
import { creditAmount, vndAmount } from "../src/features/wallet/utils/amount";
import { parsePayment } from "../src/features/wallet/schemas/payment-contracts";
import { paymentWire } from "./fixtures/payment-api";

const local = createRequire(
  new URL(
    "../src/features/wallet/components/payment-cancel-action.tsx",
    import.meta.url,
  ),
);
let confirming = false;
const leaf = () => null;
const modalLeaf = () => null;
const jsx = (type: unknown, props: unknown) => ({ type, props });
const replacements = {
  "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
  react: {
    useEffect: (work: () => unknown) => {
      work();
    },
    useState: () => [
      confirming,
      (value: boolean) => {
        confirming = value;
      },
    ],
  },
  "@/components/FormNotice": { FormNotice: leaf },
  "@/components/Button": { Button: leaf },
  "./wallet-ui": { Copy: leaf },
  "./payment-action": { PaymentAction: leaf },
  "react-native": {
    Modal: modalLeaf,
    Pressable: leaf,
    ScrollView: leaf,
    ActivityIndicator: leaf,
    Text: leaf,
    View: leaf,
    StyleSheet: { create: (value: unknown) => value, absoluteFill: {} },
  },
  "@/components/SafeArea": { SafeAreaView: leaf },
  "@/components/Icon": { Icon: leaf },
  "@/constants/theme": {
    appColors: {},
    appRadius: {},
    fonts: {},
    typography: { heading: {}, body: {} },
  },
  "./payment-surface": { PaymentSurface: leaf, paymentSurfaceStyles: {} },
};
const contexts = Object.entries(replacements).map(([name, namedExports]) =>
  mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
);
let panel: typeof PaymentCancelAction;
let dialog: typeof PaymentCancelDialog;
let statusPanel: typeof SimplePaymentStatus;
try {
  dialog = local("./payment-cancel-dialog").PaymentCancelDialog;
  panel = local("./payment-cancel-action").PaymentCancelAction;
  statusPanel = local("./simple-payment-status").SimplePaymentStatus;
} finally {
  delete local.cache[local.resolve("./payment-cancel-action")];
  delete local.cache[local.resolve("./payment-cancel-dialog")];
  delete local.cache[local.resolve("./simple-payment-status")];
  for (const context of contexts.reverse()) context.restore();
}
type Element = {
  type?: unknown;
  props?: {
    children?: unknown;
    onPress?: () => void;
    disabled?: boolean;
    accessibilityLabel?: string;
    visible?: boolean;
    onRequestClose?: () => void;
  };
};
function elements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const value = node as Element;
  if (value.type === dialog)
    return elements(
      dialog(value.props as Parameters<typeof PaymentCancelDialog>[0]),
    );
  if (value.type === modalLeaf && !value.props?.visible) return [value];
  if (
    typeof value.type === "function" &&
    value.type !== leaf &&
    value.type !== modalLeaf
  )
    return elements(value.type(value.props));
  return [value, ...elements(value.props?.children)];
}
const button = (tree: unknown, caption: string) =>
  elements(tree).find(
    (value) =>
      value.props?.accessibilityLabel === caption ||
      value.props?.children === caption,
  );

test("cancel requires two explicit presses; declining does not send a financial request", () => {
  let requests = 0;
  confirming = false;
  const props = {
    state: { stage: "known" as const, draft: "", busy: false, canCancel: true },
    active: true,
    onCancel: () => {
      requests++;
    },
  };
  button(panel(props), "Hủy thanh toán")!.props!.onPress!();
  assert.equal(requests, 0);
  assert.equal(
    elements(panel(props)).find((node) => node.type === modalLeaf)?.props
      ?.visible,
    true,
  );
  button(panel(props), "Tiếp tục thanh toán")!.props!.onPress!();
  assert.equal(requests, 0);
  assert.equal(confirming, false);
  button(panel(props), "Hủy thanh toán")!.props!.onPress!();
  button(panel(props), "Xác nhận hủy thanh toán")!.props!.onPress!();
  assert.equal(requests, 1);
  assert.equal(confirming, false);
});

test("cancel UI blocks inactive/busy actions and hides mutation for terminal/review state", () => {
  for (const [active, busy] of [
    [false, false],
    [true, true],
  ] as const) {
    confirming = true;
    const tree = panel({
      state: { stage: "known", draft: "", busy, canCancel: true },
      active,
      onCancel: () => assert.fail("inactive/busy must not send cancel"),
    });
    const confirm = button(tree, "Xác nhận hủy thanh toán");
    if (!active) {
      assert.equal(confirm, undefined);
      continue;
    }
    assert(confirm);
    assert.equal(confirm.props!.disabled, true);
    confirm.props!.onPress!();
  }
  confirming = false;
  const tree = panel({
    state: { stage: "known", draft: "", busy: false, canCancel: false },
    active: true,
    onCancel: () => assert.fail("hidden cancel must not send"),
  });
  assert.equal(button(tree, "Hủy thanh toán"), undefined);
  const retry = panel({
    state: {
      stage: "known",
      draft: "",
      busy: false,
      canCancel: true,
      cancelUnconfirmed: true,
      cancelNotice: "Chưa xác nhận hủy",
    },
    active: true,
    onCancel: () => assert.fail("rendering retry must not send"),
  });
  assert(button(retry, "Thử hủy lại"));
  assert(button(retry, "Chưa xác nhận hủy"));
});

test("polling keeps cancel and its confirmation enabled without a layout reload", () => {
  let requests = 0;
  confirming = false;
  const props = {
    active: true,
    state: {
      stage: "known" as const,
      draft: "",
      busy: true,
      checking: true,
      canCancel: true,
    },
    onCancel: () => requests++,
  };
  const cancel = button(panel(props), "Hủy thanh toán")!;
  assert(cancel);
  assert.equal(cancel.props!.disabled, false);
  cancel.props!.onPress!();
  assert.equal(requests, 0);
  const confirm = button(panel(props), "Xác nhận hủy thanh toán")!;
  assert(confirm);
  assert.equal(confirm.props!.disabled, false);
  confirm.props!.onPress!();
  assert.equal(requests, 1);
  const cancelling = panel({
    ...props,
    state: {
      ...props.state,
      checking: false,
      cancelling: true,
      canCancel: false,
      cancelUnconfirmed: true,
    },
  });
  const pending = button(cancelling, "Đang hủy thanh toán…")!;
  assert(pending);
  assert.equal(pending.props!.disabled, true);
  pending.props!.onPress!();
  assert.equal(requests, 1);
});

test("restoring a pending payment never claims that the user requested cancellation", () => {
  confirming = false;
  const tree = panel({
    active: true,
    state: {
      stage: "known",
      draft: "",
      busy: true,
      checking: false,
      canCancel: false,
      payment: parsePayment(paymentWire()),
    },
    onCancel: () => assert.fail("restoration must not cancel"),
  });
  assert.equal(button(tree, "Đang xử lý yêu cầu hủy…"), undefined);
  assert.equal(button(tree, "Đang hủy thanh toán…"), undefined);
  assert(button(tree, "Hủy thanh toán"));
});

test("stale reads keep the cancel button and modal enabled without dispatch before explicit confirmation", () => {
  let requests = 0;
  confirming = false;
  const state = {
    stage: "known" as const,
    draft: "",
    payment: parsePayment(paymentWire()),
    busy: false,
    checking: false,
    canCancel: true,
  };
  const props = {
    active: true,
    state,
    onCancel: () => requests++,
  };
  for (const pending of [
    { busy: false, checking: false, canCancel: true },
    { busy: true, checking: true, canCancel: true },
    { busy: false, checking: false, canCancel: false },
    { busy: true, checking: true, canCancel: false },
    { busy: false, checking: false, canCancel: true },
  ]) {
    const cancel = button(
      panel({ ...props, state: { ...state, ...pending } }),
      "Hủy thanh toán",
    );
    assert(cancel, "retained PENDING payment must keep its cancel button");
    assert.equal(
      cancel.props!.disabled,
      false,
      "background reads must not fade the button",
    );
    assert.equal(confirming, false);
  }
  button(panel(props), "Hủy thanh toán")!.props!.onPress!();
  const stale = panel({ ...props, state: { ...state, canCancel: false } });
  const confirm = button(stale, "Xác nhận hủy thanh toán");
  assert(confirm, "a failed GET must not collapse an open confirmation");
  assert.equal(confirm.props!.disabled, false);
  assert.equal(requests, 0, "opening the modal must not send cancel");
  assert.equal(confirming, true);
  confirm.props!.onPress!();
  assert.equal(requests, 1);
  for (const status of ["PAID", "CANCELLED", "EXPIRED", "REVIEW"]) {
    confirming = true;
    const terminal = panel({
      ...props,
      state: {
        ...state,
        canCancel: false,
        payment: parsePayment(paymentWire(status, 2)),
      },
    });
    assert.equal(button(terminal, "Hủy thanh toán"), undefined);
    assert.equal(button(terminal, "Xác nhận hủy thanh toán"), undefined);
    assert.equal(confirming, false, "a final update must dismiss the modal");
  }
  const denied = panel({
    ...props,
    state: { ...state, canCancel: false, readDenied: true },
  });
  assert.equal(button(denied, "Hủy thanh toán"), undefined);
});

test("Android back, backdrop and leaving the screen dismiss confirmation without sending cancel", () => {
  const props = {
    active: true,
    state: {
      stage: "known" as const,
      draft: "",
      busy: false,
      canCancel: true,
      payment: parsePayment(paymentWire()),
    },
    onCancel: () => assert.fail("dismissal must not submit cancel"),
  };
  for (const close of ["back", "backdrop", "inactive"]) {
    confirming = false;
    button(panel(props), "Hủy thanh toán")!.props!.onPress!();
    const tree = panel(props);
    if (close === "back")
      elements(tree).find((node) => node.type === modalLeaf)!.props!
        .onRequestClose!();
    if (close === "backdrop")
      button(tree, "Đóng xác nhận hủy thanh toán")!.props!.onPress!();
    if (close === "inactive") panel({ ...props, active: false });
    assert.equal(confirming, false);
    assert.equal(button(panel(props), "Xác nhận hủy thanh toán"), undefined);
  }
});

test("ordinary automatic status displays recovery-pending guidance for CREATED/PENDING", () => {
  for (const state of ["CREATED", "PENDING"] as const) {
    const tree = statusPanel({
      automatic: true,
      watching: true,
      state: {
        status: "ready",
        stale: false,
        recoveryRequired: true,
        recoveryReason: "PAYMENT_RECOVERY_PENDING",
        data: {
          paymentId: "known-payment",
          state,
          amountVnd: vndAmount("123000"),
          credit: creditAmount("123.00"),
        },
      },
    });
    assert(
      elements(tree).some(
        (value) =>
          typeof value.props?.children === "string" &&
          value.props.children.includes("khôi phục"),
      ),
    );
  }
});
