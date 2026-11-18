import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";
import { fixtureMaterial, materialOtherId } from "./fixtures/materials-data";

type Node = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}

test("checkout keeps its explicit purchase action in the footer, blocks stale/unresolved reads and preserves uncertain recovery", async () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/screens/purchase-screen.tsx",
      import.meta.url,
    ),
  );
  const material = fixtureMaterial({
    status: "PUBLISHED",
    accessType: "PAID",
    priceCredit: "25.50",
  });
  const query = {
    data: material as typeof material | undefined,
    isLoading: false,
    isFetching: false,
    error: undefined as unknown,
    refetch: async () => {},
  };
  const ownership = { ...query, data: null as unknown };
  const runtime = {
    key: ["buyer", 1],
    userId: materialOtherId,
    isCurrent: () => true,
  };
  const purchases: unknown[] = [];
  const routes: string[] = [];
  let checks = 0;
  const state: unknown[] = [];
  let stateIndex = 0;
  const confirming = { current: false };
  let finishPurchase!: () => void;
  const command = {
    pending: false,
    uncertain: false,
    error: undefined as unknown,
    buy: async (row: unknown) => {
      purchases.push(row);
      await new Promise<void>((resolve) => {
        finishPurchase = resolve;
      });
      return undefined;
    },
    check: async () => {
      checks++;
      return undefined;
    },
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    react: {
      useState: (initial: unknown) => {
        const slot = stateIndex++;
        if (!(slot in state)) state[slot] = initial;
        return [
          state[slot],
          (value: unknown) => {
            state[slot] = value;
          },
        ];
      },
      useRef: () => confirming,
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { View: "View", Text: "Text" },
    "expo-router": {
      useLocalSearchParams: () => ({ id: material.id }),
      useRouter: () => ({
        push: (url: string) => routes.push(url),
        replace: (url: string) => routes.push(url),
      }),
    },
    "@/components/feature-page": { FeaturePage: "Page" },
    "@/components/Button": { Button: "Button" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/features/connections": {
      useConnections: () => runtime,
      ConnectionFeedback: "Feedback",
      connectionError: () => "error",
    },
    "../hooks/use-materials": {
      useMaterial: () => query,
      useMaterialOwnership: () => ownership,
    },
    "../hooks/use-material-purchase": { useMaterialPurchase: () => command },
    "../components/material-purchase-overview": {
      MaterialPurchaseOverview: "Overview",
    },
    "../components/material-purchase-dialog": {
      MaterialPurchaseDialog: "PurchaseDialog",
    },
    "../components/material-purchase.styles": { materialPurchaseStyles: {} },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const file = local.resolve("./purchase-screen.tsx");
  try {
    delete local.cache[file];
    const { MaterialPurchaseScreen } = local(file);
    const render = () => {
      stateIndex = 0;
      const root = MaterialPurchaseScreen();
      const page = root.type(root.props) as Node;
      return { body: nodes(page), footer: nodes(page.props.stickyFooter) };
    };
    const confirm = () =>
      render().footer.find(
        (node) =>
          typeof node.props.accessibilityLabel === "string" &&
          node.props.accessibilityLabel.startsWith("Xác nhận mua ·"),
      );
    const dialog = () =>
      render().body.find((node) => node.type === "PurchaseDialog")!;
    assert.equal(
      purchases.length,
      0,
      "rendering checkout cannot buy a material",
    );
    assert.ok(confirm());
    assert.equal(
      render().body.some((node) => node.props.children === "Xác nhận mua"),
      false,
    );
    assert.equal(confirm()!.props.disabled, false);
    (confirm()!.props.onPress as () => void)();
    assert.equal(
      purchases.length,
      0,
      "the checkout action only opens confirmation",
    );
    assert.equal(dialog().props.material, material);
    (dialog().props.onClose as () => void)();
    assert.equal(dialog().props.material, undefined);
    assert.equal(purchases.length, 0, "cancelling confirmation cannot buy");
    (confirm()!.props.onPress as () => void)();
    const accept = dialog().props.onConfirm as () => void;
    accept();
    accept();
    assert.deepEqual(purchases, [material]);
    (dialog().props.onClose as () => void)();
    assert.ok(
      dialog().props.material,
      "a dispatched purchase cannot be cancelled or submitted twice",
    );
    finishPurchase();
    await new Promise(setImmediate);
    assert.equal(dialog().props.material, undefined);
    for (const block of [
      "listing-fetch",
      "listing-error",
      "ownership-fetch",
      "ownership-error",
      "ownership-unknown",
      "pending",
      "unpublished",
    ]) {
      query.isFetching = block === "listing-fetch";
      query.error =
        block === "listing-error" ? new AppError("network") : undefined;
      ownership.isFetching = block === "ownership-fetch";
      ownership.error =
        block === "ownership-error" ? new AppError("http", 403) : undefined;
      ownership.data = block === "ownership-unknown" ? undefined : null;
      command.pending = block === "pending";
      query.data = {
        ...material,
        status: block === "unpublished" ? "ARCHIVED" : "PUBLISHED",
      };
      assert.equal(confirm()!.props.disabled, true, block);
      (confirm()!.props.onPress as () => void)();
      assert.equal(purchases.length, 1, block + " cannot send a purchase");
    }
    query.data = material;
    command.pending = false;
    (confirm()!.props.onPress as () => void)();
    query.data = {
      ...material,
      listingVersion: material.listingVersion + 1,
      priceCredit: "30.00",
    };
    assert.equal(
      dialog().props.material,
      material,
      "the confirmation retains the price the user saw",
    );
    assert.equal(dialog().props.stale, true);
    assert.equal(dialog().props.disabled, true);
    (dialog().props.onConfirm as () => void)();
    assert.equal(
      purchases.length,
      1,
      "a changed price/version requires reopening confirmation",
    );
    (dialog().props.onClose as () => void)();
    query.data = material;
    command.uncertain = true;
    command.error = new AppError("network");
    assert.equal(confirm(), undefined);
    const recovery = render().footer.find(
      (node) => node.props.children === "Kiểm tra giao dịch mua",
    )!;
    assert.ok(recovery);
    assert.equal(checks, 0, "uncertain results wait for an explicit check");
    await (recovery.props.onPress as () => Promise<void>)();
    assert.equal(checks, 1);
    assert.equal(purchases.length, 1);
    assert.equal(
      render().body.find((node) => node.type === "Overview")!.props
        .walletDisabled,
      true,
    );
    command.uncertain = false;
    command.error = undefined;
    for (const kind of ["free", "owner", "purchased"]) {
      query.data = {
        ...material,
        accessType: kind === "free" ? "FREE" : "PAID",
      };
      runtime.userId = kind === "owner" ? material.ownerId : materialOtherId;
      ownership.data = kind === "purchased" ? { status: "SUCCESS" } : null;
      assert.equal(
        confirm(),
        undefined,
        kind + " does not need another purchase",
      );
      const open = render().footer.find((node) => node.type === "Button")!;
      (open.props.onPress as () => void)();
      assert.equal(routes.at(-1), `/materials/${material.id}`);
    }
    query.data = undefined;
    assert.equal(render().footer.length, 0);
    assert.equal(purchases.length, 1);
  } finally {
    contexts.reverse().forEach((context) => context.restore());
    delete local.cache[file];
  }
});
