import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import {
  walletBack,
  walletFallback,
} from "../src/features/wallet/utils/navigation";
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
  assert.equal(walletFallback("payment"), "/wallet");
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
test("wallet demo screens, routes and entry links are absent from the application", () => {
  assert.equal(
    existsSync(new URL("../src/features/wallet/preview", import.meta.url)),
    false,
  );
  assert.equal(
    existsSync(new URL("../src/app/ui/wallet-preview.tsx", import.meta.url)),
    false,
  );
  for (const file of [
    "features/wallet/index.ts",
    "features/ui-preview/screens.tsx",
    "features/auth/components/AuthNavigator.tsx",
    "features/product-shell/context.tsx",
  ]) {
    assert.doesNotMatch(source(file), /WalletPreview|wallet-preview/);
  }
});

test("normal payment screens use their coordinator and never adopt URL financial outcomes", () => {
  const screens = source("features/wallet/screens.tsx");
  assert.match(screens, /TopupPreparationScreen/);
  assert.match(screens, /PaymentPreparationScreen/);
  const normal = source("features/wallet/views/topup-screen.tsx");
  assert.doesNotMatch(
    normal,
    /useLocalSearchParams|confirmModel|previewDispatch|\.request|fetch\(/,
  );
  assert.equal(
    existsSync(
      new URL(
        "../src/features/wallet/components/topup-form.tsx",
        import.meta.url,
      ),
    ),
    false,
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
    "utils/payment-observation.ts",
    "utils/payment-refresh.ts",
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
