import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";
import type { RewardProduct } from "../src/features/rewards/api/reward-contracts";
import type { RedemptionState } from "../src/features/rewards/utils/redemption-coordinator";
type Footer =
  typeof import("../src/features/rewards/components/voucher-redeem-footer").VoucherRedeemFooter;
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
  return typeof tree === "string" || typeof tree === "number"
    ? String(tree)
    : "";
}
function withFooter(run: (render: Footer) => void) {
  const local = createRequire(
    new URL(
      "../src/features/rewards/components/voucher-redeem-footer.tsx",
      import.meta.url,
    ),
  );
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const mocks = Object.entries({
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      Text: "Text",
      View: "View",
      StyleSheet: { create: (value: unknown) => value },
    },
    "@/components/Button": { Button: "Button" },
    "@/components/FormNotice": { FormNotice: "Notice" },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const filename = local.resolve("./voucher-redeem-footer.tsx");
  try {
    delete local.cache[filename];
    run(local(filename).VoucherRedeemFooter);
  } finally {
    mocks.forEach((context) => context.restore());
    delete local.cache[filename];
  }
}
const product: RewardProduct = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Voucher 50.000đ",
  priceCredit: "50.00",
  priceVersion: 1,
  imageUrl: null,
  category: null,
  brand: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Demo",
    logoUrl: null,
  },
  faceValueVnd: "50000",
  status: "ACTIVE",
  sortOrder: 0,
  terms: null,
  validityDays: null,
};
const noAction = () => undefined;
function props(state: RedemptionState) {
  return {
    product,
    state,
    disabled: false,
    onRedeem: noAction,
    onReload: noAction,
    onRecoverStorage: noAction,
  };
}
const intent = {
  key: "33333333-3333-4333-8333-333333333333",
  productId: product.id,
  expectedPriceVersion: 1,
};

test("insufficient purchased credit shows one notice and keeps only the redeem action", () =>
  withFooter((render) => {
    const tree = render({
      ...props({
        stage: "ready",
        intent,
        error: new AppError("http", 409, "INSUFFICIENT_PURCHASED_CREDIT"),
      }),
    });
    const elements = nodes(tree);
    const notices = elements.filter((item) => item.type === "Notice");
    assert.equal(notices.length, 1);
    assert.match(text(notices[0]), /Số Credit đã nạp chưa đủ/);
    assert.doesNotMatch(text(tree), /Credit thưởng|kiếm được/);
    assert.match(text(tree), /Credit cần đổi50 Credit/);
    const buttons = elements.filter((item) => item.type === "Button");
    assert.equal(buttons.length, 1);
    assert.equal(text(buttons[0]), "Đổi voucher");
  }));
test("a rejected request for another voucher cannot leave an error on the current product", () =>
  withFooter((render) => {
    const tree = render(
      props({
        stage: "ready",
        intent: {
          ...intent,
          productId: "44444444-4444-4444-8444-444444444444",
        },
        error: new AppError("http", 409, "INSUFFICIENT_PURCHASED_CREDIT"),
      }),
    );
    assert.equal(
      nodes(tree).filter((item) => item.type === "Notice").length,
      0,
    );
    assert.doesNotMatch(text(tree), /Nạp Credit/);
  }));
test("a changed price offers reload rather than an unrelated top-up", () =>
  withFooter((render) => {
    let reloads = 0;
    const tree = render({
      ...props({
        stage: "ready",
        intent,
        error: new AppError("http", 409, "REWARD_PRICE_CHANGED"),
      }),
      onReload: () => {
        reloads++;
      },
    });
    const reload = nodes(tree).find(
      (item) => item.type === "Button" && text(item) === "Tải lại giá voucher",
    )!;
    (reload.props.onPress as () => void)();
    assert.equal(reloads, 1);
    assert.doesNotMatch(text(tree), /Nạp Credit/);
  }));
test("pending requests keep the redeem action disabled and do not expose a top-up action", () =>
  withFooter((render) => {
    const tree = render({
      ...props({ stage: "pending", intent }),
      disabled: true,
    });
    const action = nodes(tree).find((item) => item.type === "Button")!;
    assert.equal(action.props.disabled, true);
    assert.equal(text(action), "Đang đổi voucher…");
    assert.equal(
      nodes(tree).filter((item) => item.type === "Notice").length,
      0,
    );
  }));
