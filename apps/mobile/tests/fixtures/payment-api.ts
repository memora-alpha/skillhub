import { once } from "node:events";
import { createServer } from "node:http";

// Synthetic actual-contract data only; never a provider payload or account record.
export const paymentId = "10000000-0000-4000-8000-000000000001";
export const otherPaymentId = "10000000-0000-4000-8000-000000000002";
export const paymentStates = [
  "CREATED",
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "CANCELLED",
  "REVIEW",
] as const;
export function paymentWire(status = "PENDING", version = 1) {
  return {
    id: paymentId,
    gateway: "PAYOS",
    status,
    paymentAmountVnd: "123000",
    currency: "VND",
    creditAmount: "123.00",
    conversionRateVndPerCredit: 1000,
    createdAt: "2026-10-17T00:00:00.000Z",
    expiresAt: "2026-10-17T01:00:00.000Z",
    paidAt: null as string | null,
    version,
    recoveryRequired: status === "REVIEW",
    recoveryReason: status === "REVIEW" ? "PAYMENT_REVIEW_REQUIRED" : null,
    checkout:
      status === "PENDING"
        ? {
            providerStatus: "PENDING",
            paymentLinkId: "synthetic-link",
            orderCode: "9007199254740993001",
            qrCode: " SYNTHETIC-ONLY\nVí thử nghiệm 🧪 ",
          }
        : null,
  };
}
export const paymentSuccess = (data: unknown) => ({
  success: true,
  message: "Operation completed successfully.",
  data,
});
export const paymentPage = (data: unknown[] = [paymentWire()]) => ({
  ...paymentSuccess(data),
  meta: { pagination: { limit: 20, hasMore: false, nextCursor: null } },
});
export const paymentFailure = (statusCode: number, message: string) => ({
  success: false,
  message,
  statusCode,
});
export async function startPaymentContractFixture() {
  let status = 200,
    payload: unknown = paymentSuccess(paymentWire());
  const events: { method: string; authorized: boolean }[] = [];
  const server = createServer((req, res) => {
    events.push({
      method: req.method ?? "GET",
      authorized: req.headers.authorization === "Bearer fixture-only",
    });
    res.writeHead(status, {
      "Content-Type": "application/json",
      Connection: "close",
    });
    res.end(JSON.stringify(payload));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Loopback fixture failed");
  return {
    url: `http://127.0.0.1:${address.port}/contract`,
    events,
    respond: (code: number, body: unknown) => {
      status = code;
      payload = body;
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
