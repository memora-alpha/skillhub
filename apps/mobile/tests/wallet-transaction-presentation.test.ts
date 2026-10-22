import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { parseTransaction } from "../src/features/wallet/schemas/transaction-contracts";
import { transactionTime } from "../src/features/wallet/utils/transaction-labels";
import { ledgerModel } from "./fixtures/wallet-model";
import type { TransactionReceipt } from "../src/features/wallet/components/transaction-receipt";
import type { TransactionRow } from "../src/features/wallet/components/transaction-row";
import type { HistoryFilters } from "../src/features/wallet/components/history-filters";
import type { HistoryFilters as Selection } from "../src/features/wallet/types/transaction";

const row = (overrides: Record<string, unknown> = {}) =>
  parseTransaction({
    ...ledgerModel(1),
    type: "TOP_UP",
    status: "SUCCESS",
    amount: "100.00",
    availableDelta: "100.00",
    heldDelta: "0.00",
    availableAfter: "123.45",
    heldAfter: "0.00",
    ...overrides,
  });

const local = createRequire(
  new URL(
    "../src/features/wallet/components/transaction-receipt.tsx",
    import.meta.url,
  ),
);
const leaf = () => null;
const jsx = (type: unknown, props: Record<string, unknown>) =>
  typeof type === "function" && type !== leaf ? type(props) : { props };
const contexts = Object.entries({
  "react/jsx-runtime": { jsx, jsxs: jsx },
  "react-native": {
    View: leaf,
    Text: leaf,
    Pressable: leaf,
    StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
  },
  "@/constants/theme": {
    appRadius: { control: 12 },
    fonts: {},
    typography: {},
  },
}).map(([name, namedExports]) =>
  mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
);
let receipt: typeof TransactionReceipt;
let transactionRow: typeof TransactionRow;
let filters: typeof HistoryFilters;
try {
  receipt = local("./transaction-receipt").TransactionReceipt;
  transactionRow = local("./transaction-row").TransactionRow;
  filters = local("./history-filters").HistoryFilters;
} finally {
  for (const path of [
    "./transaction-receipt",
    "./transaction-row",
    "./history-filters",
    "./history-filter-control",
  ])
    delete local.cache[local.resolve(path)];
  for (const context of contexts.reverse()) context.restore();
}
type Node = { props: Record<string, unknown> };
function nodes(node: unknown): Node[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (node && typeof node === "object" && "props" in node) {
    const value = node as Node;
    return [value, ...nodes(value.props.children)];
  }
  return [];
}
function text(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (node && typeof node === "object" && "props" in node)
    return text((node as Node).props.children);
  return "";
}
const buttons = (node: unknown) =>
  nodes(node).filter((entry) => entry.props.accessibilityRole === "button");
const press = (node: Node) => (node.props.onPress as () => void)();

test("receipt retains exact Credit, time and transaction identity, omitting balances and internal IDs", () => {
  const entry = row({ amount: "9007199254740993.01" });
  const rendered = text(receipt({ row: entry }));
  assert.match(rendered, /9.007.199.254.740.993,01 CR/);
  assert.match(rendered, /Đã ghi nhận/);
  assert(rendered.includes(transactionTime(entry.createdAt)));
  assert(rendered.includes(entry.id));
  assert(!rendered.includes(entry.operationId));
  assert(!rendered.includes(entry.referenceId));
  assert.doesNotMatch(
    rendered,
    /Biến động|Số dư|Khả dụng|tạm giữ|123,45|VND|Ngân hàng|Người nhận|Mã nghiệp vụ|Giao dịch gốc/,
  );
});

test("receipt preserves server status and the original transaction link on a reversal", () => {
  const original = ledgerModel(2).id;
  for (const [status, label] of [
    ["PENDING", "Đang chờ"],
    ["FAILED", "Không thành công"],
    ["REVERSED", "Đã được đảo"],
  ]) {
    const rendered = text(
      receipt({ row: row({ status, reversesTransactionId: original }) }),
    );
    assert(rendered.includes(label!));
    assert(rendered.includes(original));
    assert.match(rendered, /Giao dịch gốc/);
    assert.doesNotMatch(rendered, /Đã ghi nhận/);
  }
});

test("each history row includes its own full time/date and opens the selected transaction", () => {
  let opens = 0;
  for (const createdAt of ["2026-10-22T06:00:00Z", "2026-10-21T06:00:00Z"]) {
    const entry = row({ createdAt, type: "HOLD", status: "PENDING" });
    const rendered = transactionRow({
      row: entry,
      onOpen: () => {
        opens++;
      },
    });
    assert(text(rendered).includes(transactionTime(createdAt)));
    assert.match(text(rendered), /100,00 CR/);
    assert.match(text(rendered), /Đang chờ/);
    assert.doesNotMatch(text(rendered), /[+-]100,00 CR/);
    press(buttons(rendered)[0]!);
  }
  assert.equal(opens, 2);
});

test("visible filter segments keep backend type/reference semantics and ignore reselecting the current group", () => {
  const changed: Selection[] = [];
  const rendered = filters({
    filters: {},
    onChange: (value) => changed.push(value),
  });
  const options = buttons(rendered);
  assert.deepEqual(
    options.map((option) => text(option)),
    ["Tất cả", "Nạp Credit", "Học tập"],
  );
  assert.deepEqual(
    options.map((option) => option.props.accessibilityState),
    [{ selected: true }, { selected: false }, { selected: false }],
  );
  press(options[0]!);
  press(options[1]!);
  press(options[2]!);
  assert.deepEqual(changed, [
    { type: "TOP_UP" },
    { referenceType: "LEARNING_PATH" },
  ]);
});

test("a retained combined filter stays visible until the user explicitly chooses another segment", () => {
  const changed: Selection[] = [];
  const rendered = filters({
    filters: { type: "HOLD", referenceType: "LEARNING_PATH" },
    onChange: (value) => changed.push(value),
  });
  const options = buttons(rendered);
  assert.equal(options.length, 4);
  assert.equal(
    (options[3]!.props.accessibilityState as { selected: boolean }).selected,
    true,
  );
  assert.match(text(options[3]), /Tạm giữ Credit · Lộ trình học/);
  assert.deepEqual(changed, []);
  press(options[3]!);
  assert.deepEqual(changed, []);
  press(options[0]!);
  assert.deepEqual(changed, [{}]);
});
