import { createPaymentCoordinator } from "../../src/features/wallet/utils/payment-create-coordinator";
import { createCorrelationStore } from "../../src/features/wallet/storage/correlation-store-core";
import { AppError } from "@/lib/http/errors";
import { validateTopUp } from "../../src/features/wallet/utils/topup-policy";

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
  const wire = () => ({
    id: "10000000-0000-4000-8000-000000000001",
    gateway: "PAYOS",
    status:
      mode === "paid"
        ? "PAID"
        : mode === "review"
          ? "REVIEW"
          : mode === "created"
            ? "CREATED"
            : "PENDING",
    paymentAmountVnd: amount,
    currency: "VND",
    creditAmount: validateTopUp(amount).estimatedCredit,
    conversionRateVndPerCredit: 1000,
    createdAt: "2026-10-18T00:00:00Z",
    expiresAt: "2026-10-18T01:00:00Z",
    paidAt: mode === "paid" ? "2026-10-18T00:30:00Z" : null,
    version: mode === "paid" ? 3 : mode === "created" ? 1 : 2,
    recoveryRequired: mode === "review" || hidden,
    recoveryReason:
      mode === "review"
        ? "PAYMENT_REVIEW_REQUIRED"
        : hidden
          ? "PAYMENT_CHANNEL_UNAVAILABLE"
          : null,
    checkout:
      mode === "paid" || mode === "review" || mode === "created" || hidden
        ? null
        : {
            providerStatus: "PENDING",
            paymentLinkId: "synthetic-only",
            orderCode: "123",
            qrCode: "  synthetic raw\nĐồng e\u0301 € 😀\r\n ",
          },
  });
  const boundary = {
    read: async () => raw,
    write: async (value: string) => {
      raw = value;
    },
    remove: async () => {
      raw = null;
    },
  };
  function createModel() {
    let current = true;
    const store = createCorrelationStore(identity, boundary, () => current);
    const model = createPaymentCoordinator({
      identity,
      scope,
      current: () => current,
      openStore: async () => store,
      newKey: () => `synthetic-key-${++keyCount}`,
      api: {
        creationPolicy: async () => ({
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
        detail: async () => {
          reads++;
          return wire();
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
