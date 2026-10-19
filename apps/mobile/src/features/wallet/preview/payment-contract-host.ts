import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import {
  createWalletRuntime,
  noWalletCapabilities,
} from "../context/wallet-runtime";
import { paymentReadOptions } from "../utils/payment-read-query";

// Private inert preview host, never the account provider/client/cache.
export function createPreviewPaymentHost(status: string) {
  const id = "10000000-0000-4000-8000-000000000001";

  const queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const runtime = createWalletRuntime({
    scope: { ownerId: "isolated-contract-preview", generation: 0 },
    queries,
    current: () => true,
    capabilities: {
      ...noWalletCapabilities,
      paymentStatus: true,
      wallet: true,
      history: true,
    },
  });
  let mode = "ok",
    version = 1,
    qr = true,
    readCount = 0;
  const client = {
    request: async (path: string) => {
      if (path === "/me/wallet") {
        if (mode === "wallet-error") throw new AppError("network");
        return {
          availableCredit: "123.45",
          heldCredit: "0.00",
          walletVersion: 2,
        };
      }
      readCount++;
      if (mode === "denied") throw new AppError("http", 404);
      if (mode === "error") throw new AppError("network");
      return {
        id,
        gateway: "PAYOS",
        status:
          mode === "conflict" ? "REVIEW" : mode === "paid" ? "PAID" : status,
        paymentAmountVnd: "123000",
        currency: "VND",
        creditAmount: "123.00",
        conversionRateVndPerCredit: 1000,
        createdAt: "2026-10-17T00:00:00Z",
        expiresAt: null,
        paidAt: null,
        version,
        recoveryRequired: false,
        recoveryReason: null,
        checkout:
          status === "PENDING" && qr && mode !== "paid" && mode !== "conflict"
            ? {
                providerStatus: "PENDING",
                paymentLinkId: "synthetic-only",
                orderCode: "123",
                qrCode: "SYNTHETIC ONLY",
              }
            : null,
      };
    },
    requestPage: async () => {
      if (mode === "history-error") throw new AppError("network");
      return {
        data: [],
        pagination: { limit: 20, hasMore: false, nextCursor: null },
      };
    },
  };
  const options = paymentReadOptions(runtime, client, id, queries),
    observer = new QueryObserver(queries, { ...options, enabled: false });
  return {
    id,
    queries,
    runtime,
    client,
    observer,
    options,
    get count() {
      return readCount;
    },
    setMode: (value: string) => {
      mode = value;
      if (value === "paid") version++;
      if (value === "hide") qr = false;
      if (value === "restore") qr = true;
    },
    cleanup: () => {
      runtime.dispose();
      queries.clear();
    },
  };
}
