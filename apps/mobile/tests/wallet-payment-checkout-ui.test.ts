import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { PaymentCheckout } from "../src/features/wallet/components/payment-checkout";
import { parsePayment } from "../src/features/wallet/schemas/payment-contracts";
import { paymentWire } from "./fixtures/payment-api";

const local = createRequire(
  new URL(
    "../src/features/wallet/components/payment-checkout.tsx",
    import.meta.url,
  ),
);
const leaf = () => null;
const qrLeaf = () => null;
const jsx = (type: unknown, props: unknown) => ({ type, props });
const replacements = {
  "@/components/LoadingIndicator": { LoadingIndicator: leaf },
  "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
  "react-native": {
    ActivityIndicator: leaf,
    Text: leaf,
    View: leaf,
    StyleSheet: { hairlineWidth: 1, create: (value: unknown) => value },
  },
  "@/components/Icon": { Icon: leaf },
  "@/components/Button": { Button: leaf },
  "./payment-deadline": { PaymentDeadline: leaf },
  "./payment-qr": { PaymentQr: qrLeaf },
};
const contexts = Object.entries(replacements).map(([name, namedExports]) =>
  mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
);
let panel: typeof PaymentCheckout;
try {
  panel = local("./payment-checkout").PaymentCheckout;
} finally {
  delete local.cache[local.resolve("./payment-checkout")];
  for (const context of contexts.reverse()) context.restore();
}
type Node = {
  type?: unknown;
  props?: {
    children?: unknown;
    onPress?: () => void;
    disabled?: boolean;
    model?: unknown;
  };
};
function elements(node: unknown): Node[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Node;
  if (
    typeof element.type === "function" &&
    element.type !== leaf &&
    element.type !== qrLeaf
  )
    return elements(element.type(element.props));
  return [element, ...elements(element.props?.children)];
}
const text = (tree: unknown) =>
  elements(tree)
    .flatMap((node) =>
      typeof node.props?.children === "string" ? [node.props.children] : [],
    )
    .join(" ");
const props = (): Parameters<typeof PaymentCheckout>[0] => {
  const payment = parsePayment(paymentWire());
  return {
    payment,
    qr: {
      stage: "ready-model",
      paymentId: payment.id,
      raw: payment.checkout!.qrCode,
    },
    active: true,
    watching: true,
  };
};

test("native checkout displays the server quote and QR, never sample bank/support promises", () => {
  const input = props(),
    tree = panel(input),
    rendered = text(tree);
  assert.match(rendered, /123\.000 VND/);
  assert.match(rendered, /123,00 CR/);
  assert.match(rendered, /10000000-0000-4000-8000-000000000001/);
  assert.equal(
    elements(tree).find((node) => node.type === qrLeaf)?.props?.model,
    input.qr,
  );
  assert.doesNotMatch(
    rendered,
    /MBBank|1900|SSL|30-60|tự động làm mới|CONG TY|SKILLHUB NAP/,
  );
});

test("hidden/stale/mismatched/inactive/cancelling checkout never exposes a usable QR", () => {
  for (const scenario of [
    "hidden",
    "stale",
    "mismatch",
    "inactive",
    "cancel",
    "created",
  ] as const) {
    const input = props();
    if (scenario === "hidden")
      input.payment = parsePayment({
        ...paymentWire(),
        checkout: null,
        recoveryRequired: true,
        recoveryReason: "PAYMENT_RECOVERY_PENDING",
      });
    if (scenario === "stale") input.stale = true;
    if (scenario === "mismatch") input.qr = { ...input.qr, raw: "different" };
    if (scenario === "inactive") input.active = false;
    if (scenario === "cancel") input.cancelUnconfirmed = true;
    if (scenario === "created")
      input.payment = parsePayment(paymentWire("CREATED"));
    const tree = panel(input);
    assert.equal(
      elements(tree).find((node) => node.type === qrLeaf),
      undefined,
      scenario,
    );
    if (scenario === "hidden") assert.match(text(tree), /khôi phục/);
  }
});

test("checkout relies on automatic observation without manual check, scan guidance or help", () => {
  for (const [active, watching] of [
    [false, false],
    [true, false],
    [true, true],
  ] as const) {
    const input = {
      ...props(),
      active,
      watching,
    };
    const buttons = elements(panel(input)).filter(
      (node) => node.props?.onPress,
    );
    assert.equal(buttons.length, 0);
    assert.doesNotMatch(
      text(panel(input)),
      /trợ giúp|hỗ trợ|quét mã|Hướng dẫn quét QR|Kiểm tra trạng thái|kiểm tra lại/i,
    );
    if (active && watching)
      assert.match(text(panel(input)), /Kết quả sẽ tự động cập nhật/);
    if (active && !watching)
      assert.match(text(panel(input)), /Mở lại thanh toán từ ví/);
  }
});
