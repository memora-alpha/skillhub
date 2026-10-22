import { createPaymentCoordinator } from "../../src/features/wallet/utils/payment-create-coordinator";
import { createCorrelationStore } from "../../src/features/wallet/storage/correlation-store-core";
import { AppError } from "@/lib/http/errors";
import { validateTopUp } from "../../src/features/wallet/utils/topup-policy";

function scenarioStatus(mode: string) {
  switch (mode) {
    case "paid":
      return "PAID";
    case "review":
      return "REVIEW";
    case "created":
      return "CREATED";
    default:
      return "PENDING";
  }
}

// Synthetic in-memory boundary. No account/provider client, HTTP or SecureStore.
export function createInertTopupHost() {
  let raw: string | null = null,
    keyCount = 0,
    posts = 0,
    reads = 0,
    mode = "ok",
    amount = "100000",
    hidden = false;
  const identity = {
    ownerId: "synthetic-create-preview",
    environment: "https://synthetic.invalid/api/v1",
  };
  const scope = { ownerId: identity.ownerId, generation: 0 };
  const wire = () => {
    let version = 2;
    if (mode === "paid") version = 3;
    else if (mode === "created") version = 1;
    let recoveryReason = null;
    if (mode === "review") recoveryReason = "PAYMENT_REVIEW_REQUIRED";
    else if (hidden) recoveryReason = "PAYMENT_CHANNEL_UNAVAILABLE";
    return {
      id: "10000000-0000-4000-8000-000000000001",
      gateway: "PAYOS",
      status: scenarioStatus(mode),
      paymentAmountVnd: amount,
      currency: "VND",
      creditAmount: validateTopUp(amount).estimatedCredit,
      conversionRateVndPerCredit: 1000,
      createdAt: "2026-10-18T00:00:00Z",
      expiresAt: "2026-10-18T01:00:00Z",
      paidAt: mode === "paid" ? "2026-10-18T00:30:00Z" : null,
      version,
      recoveryRequired: mode === "review" || hidden,
      recoveryReason,
      checkout:
        mode === "paid" || mode === "review" || mode === "created" || hidden
          ? null
          : {
              providerStatus: "PENDING",
              paymentLinkId: "synthetic-only",
              orderCode: "123",
              qrCode: "  synthetic raw\nĐồng e\u0301 € 😀\r\n ",
            },
    };
  };
  const boundary = {
    read: () => Promise.resolve(raw),
    write: (value: string) => {
      raw = value;
      return Promise.resolve();
    },
    remove: () => {
      raw = null;
      return Promise.resolve();
    },
  };
  function createModel() {
    let current = true;
    const store = createCorrelationStore(identity, boundary, () => current);
    const model = createPaymentCoordinator({
      identity,
      scope,
      current: () => current,
      openStore: () => Promise.resolve(store),
      newKey: () => `synthetic-key-${++keyCount}`,
      api: {
        creationPolicy: () =>
          Promise.resolve({
            canCreate: mode !== "policy-block",
            reasonCode:
              mode === "policy-block" ? "PAYMENT_CREATION_PAUSED" : null,
            existingPaymentId: null,
          }),
        create: async (body) => {
          posts++;
          amount = body.paymentAmountVnd;
          await new Promise((resolve) => setTimeout(resolve, 50));
          if (mode === "timeout") throw new AppError("network");
          return wire();
        },
        detail: () => {
          reads++;
          return Promise.resolve().then(wire);
        },
      },
    });
    return {
      model,
      activate: () => {
        current = true;
      },
      dispose: () => {
        current = false;
        model.dispose();
      },
    };
  }
  return {
    createModel,
    setMode: (value: string) => {
      mode = value;
      hidden = value === "hidden";
    },
    counts: () => ({
      intents: keyCount,
      createCalls: posts,
      ownerReads: reads,
    }),
  };
}
