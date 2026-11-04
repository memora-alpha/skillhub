import type { Payment } from "./account-types";
export function safeDownloadUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function notificationDestination(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  for (const [key, prefix] of [
    ["sessionId", "/learn/sessions/"],
    ["pathId", "/learn/paths/"],
    ["learningPathId", "/learn/paths/"],
    ["conversationId", "/learn/messages/"],
    ["proposalId", "/learn/connections/"],
    ["materialId", "/learn/materials/"],
  ] as const) {
    if (typeof p[key] === "string" && uuid.test(p[key])) return prefix + p[key];
  }
  if (typeof p.paymentId === "string" && uuid.test(p.paymentId))
    return "/learn/wallet/topup?paymentId=" + p.paymentId;
  return null;
}

export function canShowPaymentQr(payment: Payment, now: number) {
  return (
    ["CREATED", "PENDING"].includes(payment.status) &&
    !payment.recoveryRequired &&
    payment.checkout?.providerStatus === "PENDING" &&
    typeof payment.checkout.qrCode === "string" &&
    payment.checkout.qrCode.length > 0 &&
    payment.expiresAt !== null &&
    Number.isFinite(Date.parse(payment.expiresAt)) &&
    Date.parse(payment.expiresAt) > now
  );
}
