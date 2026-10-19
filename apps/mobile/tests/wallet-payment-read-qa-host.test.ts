import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  createWalletRuntime,
  noWalletCapabilities,
} from "../src/features/wallet/context/wallet-runtime";
import {
  paymentPolicyOptions,
  projectPaymentPolicy,
} from "../src/features/wallet/utils/payment-policy-query";
import { AppError } from "../src/lib/http/errors";

test("policy cache is owner/session-scoped; denied eviction survives subsequent errors", async () => {
  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  let mode = "ok";
  const runtime = createWalletRuntime({
    scope: { ownerId: "owner-a", generation: 1 },
    queries,
    current: () => true,
    capabilities: { ...noWalletCapabilities, paymentStatus: true },
  });
  const client = {
    request: async () => {
      if (mode === "denied") throw new AppError("http", 403);
      if (mode === "error") throw new AppError("network");
      return { canCreate: true, reasonCode: null, existingPaymentId: null };
    },
  };
  const options = paymentPolicyOptions(runtime, client, queries, "qa-env");
  await queries.fetchQuery(options);
  assert.equal(
    projectPaymentPolicy(
      runtime,
      queries.getQueryData(options.queryKey),
      null,
      false,
    ).data?.canCreate,
    true,
  );
  mode = "denied";
  await queries.fetchQuery(options);
  mode = "error";
  await assert.rejects(queries.fetchQuery(options));
  assert.equal(
    projectPaymentPolicy(
      runtime,
      queries.getQueryData(options.queryKey),
      new Error(),
      false,
    ).status,
    "denied",
  );
  runtime.dispose();
  assert.equal(queries.getQueryData(options.queryKey), undefined);
  queries.clear();
});
test("late old-session policy cannot populate current cache", async () => {
  const queries = new QueryClient();
  let done: (x: unknown) => void = () => {};
  const runtime = createWalletRuntime({
    scope: { ownerId: "owner-a", generation: 2 },
    queries,
    current: () => true,
    capabilities: { ...noWalletCapabilities, paymentStatus: true },
  });
  const options = paymentPolicyOptions(
    runtime,
    {
      request: () =>
        new Promise((resolve) => {
          done = resolve;
        }),
    },
    queries,
    "qa-env",
  );
  const pending = queries.fetchQuery(options);
  runtime.dispose();
  done({ canCreate: true, reasonCode: null, existingPaymentId: null });
  await assert.rejects(pending);
  assert.equal(queries.getQueryData(options.queryKey), undefined);
  queries.clear();
});
