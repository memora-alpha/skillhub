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

type EventFrame = { event: string; data: string };
type ReadHint = { eventId?: string; expectedVersion?: bigint };

function parseEnvelope(text: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AppError("protocol");
  }
  return parse(envelope, raw);
}

function readHint(
  frame: EventFrame,
  snapshot: PaymentCreateSnapshot,
  ownerId: string,
  processed: Set<string>,
): ReadHint | undefined {
  if (frame.event === "stream.ready") return {};
  if (!["payment.updated", "wallet.updated"].includes(frame.event)) return;
  const value = parseEnvelope(frame.data);
  if (processed.has(value.eventId)) return;
  if (frame.event === "wallet.updated") {
    const hint = parse(walletHint, value.data);
    if (hint.walletUserId !== ownerId) return;
    return { eventId: value.eventId };
  }
  const hint = parse(paymentHint, value.data);
  if (hint.paymentId !== snapshot.readTargetId) return;
  const expectedVersion = BigInt(hint.version);
  if (
    !snapshot.observation?.stale &&
    snapshot.payment &&
    expectedVersion <= BigInt(snapshot.payment.version)
  )
    return;
  return { eventId: value.eventId, expectedVersion };
}

// Public events carry references, never a trusted financial projection. Only a
// fresh authenticated GET may update the coordinator or complete a payment.
export function createPaymentEventReader(options: {
  ownerId: string;
  current: () => boolean;
  snapshot: () => PaymentCreateSnapshot;
  read: () => Promise<unknown>;
}) {
  const processed = new Set<string>();
  return async (frame: EventFrame, signal: AbortSignal) => {
    const snapshot = options.snapshot();
    const id = snapshot.readTargetId;
    if (!options.current() || signal.aborted || !id || snapshot.readDenied)
      return;
    const hint = readHint(frame, snapshot, options.ownerId, processed);
    if (!hint) return;
    const { eventId, expectedVersion } = hint;
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
