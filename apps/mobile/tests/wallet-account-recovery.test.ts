import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import type { AccountTopupPanel as AccountPanel } from "../src/features/wallet/components/account-topup-panel";
import { validateTopUp } from "../src/features/wallet/utils/topup-policy";

// Exercise the actual account panel's rendered callbacks with native leaves mocked.
const local = createRequire(
  new URL(
    "../src/features/wallet/components/account-topup-panel.tsx",
    import.meta.url,
  ),
);
const leaf = () => null;
const jsx = (type: unknown, props: unknown) => ({ type, props });
const replacements = {
  "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
  "react-native": {
    ActivityIndicator: leaf,
    Text: leaf,
    View: leaf,
    StyleSheet: { create: (s: unknown) => s },
  },
  "./payment-action": { PaymentAction: leaf },
  "@/components/Input": { Input: leaf },
  "@/components/FormNotice": { FormNotice: leaf },
  "@/components/Icon": { Icon: leaf },
  "@/constants/theme": {
    appColors: {},
    appRadius: { card: 12, control: 8, badge: 999 },
    fonts: {},
    typography: { title: {} },
  },
  "./wallet-ui": { Copy: leaf, WalletField: leaf },
  "./payment-surface": {
    PaymentSurface: leaf,
    PaymentMethod: leaf,
    paymentSurfaceStyles: {},
  },
  "./topup-presets": { TopupPresets: leaf },
};
const contexts = Object.entries(replacements).map(([name, namedExports]) =>
  mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
);
let panel: typeof AccountPanel;
try {
  panel = local("./account-topup-panel").AccountTopupPanel;
} finally {
  delete local.cache[local.resolve("./account-topup-panel")];
  for (const context of contexts.reverse()) context.restore();
}
type Node = {
  props?: { children?: unknown; onPress?: () => void; disabled?: boolean };
};
function elements(node: unknown): Node[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Node;
  return [element, ...elements(element.props?.children)];
}

test("account recovery exposes explicit restore and check actions without submitting a payment", () => {
  for (const scenario of ["restore", "check", "policy"] as const) {
    let restores = 0,
      checks = 0;
    const model = {
      bootstrap: async () => {
        restores++;
      },
      check: async () => {
        checks++;
      },
      confirm: () => assert.fail("Recovery must not submit"),
      replay: () => assert.fail("Recovery must not replay"),
    } as unknown as Parameters<typeof AccountPanel>[0]["model"];
    for (const [active, busy] of [
      [false, false],
      [true, true],
      [true, false],
    ] as const) {
      const tree = panel({
        model,
        active,
        state: {
          stage: "blocked",
          draft: "123000",
          busy,
          canRestore: scenario === "restore",
          readTargetId: scenario === "check" ? "existing-id" : undefined,
          canReturnToDraft: scenario === "policy",
        },
      });
      const button = elements(tree).find(
        (n) =>
          n.props?.children ===
          (scenario === "restore"
            ? "Thử khôi phục yêu cầu đã lưu"
            : "Kiểm tra yêu cầu đang mở"),
      );
      assert(button, `${scenario} must be reachable in the account panel`);
      assert.equal(button.props?.disabled, !active || busy);
      if (active && !busy) button.props?.onPress?.();
    }
    assert.equal(restores, scenario === "restore" ? 1 : 0);
    assert.equal(checks, scenario === "restore" ? 0 : 1);
    const checkout = panel({
      model,
      active: true,
      showStatusCheck: false,
      state: {
        stage: "blocked",
        draft: "123000",
        busy: false,
        canRestore: scenario === "restore",
        readTargetId: scenario === "check" ? "existing-id" : undefined,
        canReturnToDraft: scenario === "policy",
      },
    });
    assert.equal(
      elements(checkout).find(
        (node) => node.props?.children === "Kiểm tra yêu cầu đang mở",
      ),
      undefined,
    );
    if (scenario === "restore")
      assert(
        elements(checkout).some(
          (node) => node.props?.children === "Thử khôi phục yêu cầu đã lưu",
        ),
        "QR checkout must retain explicit restore when automatic reads have no ID",
      );
  }
});

const action = (tree: unknown, caption: string) =>
  elements(tree).find((element) => element.props?.children === caption);

test("ordinary payment omits unfinished help and identity-loss actions in every stage", () => {
  for (const stage of [
    "draft",
    "review",
    "unknown",
    "blocked",
    "known",
  ] as const) {
    const tree = panel({
      active: true,
      state: { stage, draft: "123000", busy: false },
      model: {
        supportStop: () => assert.fail("ordinary UI must not stop recovery"),
      } as unknown as Parameters<typeof AccountPanel>[0]["model"],
    });
    for (const caption of [
      "Cần trợ giúp?",
      "Đóng trợ giúp",
      "Tôi không tìm thấy yêu cầu cũ",
      "Tạm dừng nạp và liên hệ hỗ trợ",
    ])
      assert.equal(action(tree, caption), undefined, stage + ": " + caption);
  }
});

test("top-up draft and review omit the standalone Credit confirmation note", () => {
  const note =
    "Credit chỉ được cộng vào ví sau khi máy chủ xác nhận thanh toán.";
  for (const state of [
    { stage: "draft" as const, draft: "2000", busy: false },
    {
      stage: "review" as const,
      draft: "2000",
      busy: false,
      review: validateTopUp("2000"),
    },
  ]) {
    const tree = panel({
      active: true,
      state,
      model: {
        edit: () => {},
        back: () => {},
        confirm: () => {},
      } as unknown as Parameters<typeof AccountPanel>[0]["model"],
    });
    assert.equal(
      elements(tree).some((element) => element.props?.children === note),
      false,
    );
  }
});
