import { z } from "zod";
import { parse, uuid, sequence } from "@/lib/http/contracts";
import { AppError } from "@/lib/http/errors";
import type { PaymentCreateSnapshot } from "./payment-create-state";

const envelope = z.object({
  eventId: uuid,
  version: z.literal(1),
  data: z.unknown(),
});
const paymentHint = z.object({
  paymentId: uuid,
  status: z.string(),
  version: sequence,
});
const walletHint = z.object({ walletUserId: uuid, operationId: uuid });

// Public events carry references, never a trusted financial projection. Only a
// fresh authenticated GET may update the coordinator or complete a payment.
export function createPaymentEventReader(options: {
  ownerId: string;
  current: () => boolean;
  snapshot: () => PaymentCreateSnapshot;
  read: () => Promise<unknown>;
}) {
  const processed = new Set<string>();
  return async (
    frame: { event: string; data: string },
    signal: AbortSignal,
  ) => {
    const snapshot = options.snapshot();
    const id = snapshot.readTargetId;
    if (!options.current() || signal.aborted || !id || snapshot.readDenied)
      return;
    let eventId: string | undefined;
    let expectedVersion: bigint | undefined;
    if (frame.event !== "stream.ready") {
      if (!["payment.updated", "wallet.updated"].includes(frame.event)) return;
      let raw: unknown;
      try {
        raw = JSON.parse(frame.data);
      } catch {
        throw new AppError("protocol");
      }
      const value = parse(envelope, raw);
      eventId = value.eventId;
      if (processed.has(eventId)) return;
      if (frame.event === "payment.updated") {
        const hint = parse(paymentHint, value.data);
        if (hint.paymentId !== id) return;
        expectedVersion = BigInt(hint.version);
        if (
          !snapshot.observation?.stale &&
          snapshot.payment &&
          BigInt(hint.version) <= BigInt(snapshot.payment.version)
        )
          return;
      } else {
        const hint = parse(walletHint, value.data);
        if (hint.walletUserId !== options.ownerId) return;
      }
    }
    await options.read();
    if (
      !options.current() ||
      signal.aborted ||
      options.snapshot().readTargetId !== id
    )
      return;
    const latest = options.snapshot();
    if (latest.readDenied) return;
    if (
      !latest.payment ||
      latest.observation?.stale ||
      (expectedVersion !== undefined &&
        BigInt(latest.payment.version) < expectedVersion)
    )
      throw new AppError("network");
    if (eventId) {
      processed.add(eventId);
      if (processed.size > 200)
        processed.delete(processed.values().next().value!);
    }
  };
}
