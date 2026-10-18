import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  walletBack,
  walletFallback,
} from "../src/features/wallet/utils/navigation";
import {
  previewSelection,
  previewHref,
} from "../src/features/wallet/preview/navigation";
const source = (file: string) =>
  readFileSync(new URL("../src/" + file, import.meta.url), "utf8");
test("Back uses actual Home/Profile history; direct links fall back without side effects", () => {
  const actions: string[] = [];
  const router = {
    canGoBack: () => true,
    back: () => actions.push("back"),
    replace: (href: string) => actions.push(href),
  };
  const draft = { amount: "1000", selection: "HOLD" };
  walletBack(router, "wallet");
  walletBack({ ...router, canGoBack: () => false }, "transaction");
  walletBack(router, "payment", true);
  assert.deepEqual(actions, ["back", "/wallet/history"]);
  assert.deepEqual(draft, { amount: "1000", selection: "HOLD" });
  assert.equal(walletFallback("wallet"), "/profile");
  assert.equal(walletFallback("payment"), "/wallet/topup");
});
test("preview identity/state selection never becomes a real financial route or destination", () => {
  assert.equal(
    previewSelection({
      view: "https://evil.test",
      id: "real-id",
      state: "success",
    }).view,
    "wallet",
  );
  assert.equal(
    previewSelection({ view: "transaction", id: "real-id" }).id,
    undefined,
  );
  assert.equal(
    previewSelection({ view: "status", state: "success" }).state,
    "PAID",
  );
  assert.match(previewHref("status", "PAID"), /^\/ui\/wallet-preview\?/);
  assert.equal(previewSelection({ view: ["status", "wallet"] }).view, "wallet");
});
test("all six normal routes still use public Wallet exports and never read URL outcomes", () => {
  for (const file of [
    "index",
    "topup",
    "payment",
    "payment-status",
    "history",
    "transactions/[id]",
  ]) {
    assert.match(source("app/wallet/" + file + ".tsx"), /@\/features\/wallet/);
  }
  const screens = source("features/wallet/screens.tsx");
  assert.doesNotMatch(screens, /fixtures|useLocalSearchParams|state=|Number\(/);
  assert.match(screens, /PaymentStatusPreparationScreen/);
  assert.doesNotMatch(
    source("features/home/components/HomeContent.tsx"),
    /summary\.credit/,
  );
  assert.match(
    source("features/home/components/HomeContent.tsx"),
    /HomeWalletBalance/,
  );
});
test("preview is separately routed, labeled, inert and never imports a live financial runtime", () => {
  const preview = source("features/wallet/preview/screens.tsx");
  assert.match(preview, /DỮ LIỆU MẪU|Dữ liệu mẫu/);
  assert.doesNotMatch(
    preview,
    /useWalletRuntime|useAuthSession|useQuery|fetch\(|axios|runtime\.client/,
  );
  assert.doesNotMatch(
    source("features/wallet/preview/fixtures.ts"),
    /https?:\/\//,
  );
  assert.match(
    source("features/ui-preview/screens.tsx"),
    /\/ui\/wallet-preview/,
  );
  assert.doesNotMatch(
    source("features/product-shell/context.tsx"),
    /\/wallet\/transactions\/tx-topup/,
  );
  assert.match(
    source("features/auth/components/AuthNavigator.tsx"),
    /name="ui"/,
  );
});

test("P4 public wrappers bind preparation only; normal form cannot dispatch or trust route payment data", () => {
  const screens = source("features/wallet/screens.tsx");
  assert.match(screens, /TopupPreparationScreen/);
  assert.match(screens, /PaymentPreparationScreen/);
  const normal = source("features/wallet/views/topup-screen.tsx");
  assert.doesNotMatch(
    normal,
    /useLocalSearchParams|confirmModel|previewDispatch|\.request|fetch\(/,
  );
  assert.match(
    source("features/wallet/components/topup-form.tsx"),
    /disabled=\{!previewDispatch/,
  );
  assert.doesNotMatch(
    source("features/wallet/views/payment-screen.tsx"),
    /useLocalSearchParams|confirmModel|\.request|fetch\(/,
  );
  assert.doesNotMatch(
    source("features/wallet/components/payment-qr.tsx"),
    /Image|SvgXml|WebView|Linking|https?:\/\/|qrCode/,
  );
  assert.doesNotMatch(
    source("features/wallet/index.ts"),
    /payment-intent|payment-preparation|topup-form|payment-qr-model/,
  );
});

test("status accepts only a validated ID through the gated read hook; preview remains independent of intent", () => {
  const normal = source("features/wallet/views/payment-status-screen.tsx");
  assert.doesNotMatch(
    normal,
    /\.request|fetch\(|createPaymentObserver|useWalletRuntime|preview/,
  );
  assert.match(normal, /paymentStatusId\(useLocalSearchParams\(\)\)/);
  assert.match(normal, /usePaymentStatus\(id\)/);
  assert.doesNotMatch(
    source("features/wallet/context/WalletProvider.tsx"),
    /paymentStatus:\s*true/,
  );
  assert.match(
    source("features/wallet/screens.tsx"),
    /PaymentStatusPreparationScreen/,
  );
  for (const file of [
    "utils/payment-outcome.ts",
    "utils/payment-observer.ts",
    "utils/payment-refresh.ts",
    "preview/status.tsx",
  ]) {
    assert.doesNotMatch(
      source("features/wallet/" + file),
      /payment-intent|payment-preparation|topup-policy|useAuthSession|useWalletRuntime|fetch\(|axios|\.request\(/,
    );
  }
  assert.doesNotMatch(
    source("features/wallet/index.ts"),
    /payment-observer|payment-outcome|payment-refresh/,
  );
});
