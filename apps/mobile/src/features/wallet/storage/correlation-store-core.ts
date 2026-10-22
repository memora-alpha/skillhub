import { AppError } from "@/lib/http/errors";
import { isRecord } from "@/lib/http/response";
import type { PaymentProjection } from "../types/payment";
import {
  boundedJson,
  correlationResolved,
  parseRecoveryRecord,
  sameRecoveryIntent,
  type PaymentIdentity,
  type RecoveryRecord,
} from "../utils/payment-recovery-record";

export type CorrelationBoundary = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  remove: () => Promise<void>;
};
// All sessions/callers in this JS process share the queue; no cross-process CAS.
const queues = new Map<string, Promise<unknown>>();
export function createCorrelationStore(
  identity: PaymentIdentity,
  storage: CorrelationBoundary,
  current: () => boolean,
) {
  identity = Object.freeze({ ...identity });
  const slot = JSON.stringify([identity.environment, identity.ownerId]);
  const assertCurrent = () => {
    if (!current()) throw new AppError("session");
  };
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const previous = queues.get(slot) ?? Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(async () => {
        assertCurrent();
        return work();
      });
    queues.set(slot, next);
    void next
      .finally(() => {
        if (queues.get(slot) === next) queues.delete(slot);
      })
      .catch(() => {});
    return next;
  }
  const read = async () => {
    assertCurrent();
    const raw = await storage.read();
    assertCurrent();
    return raw;
  };
  async function write(value: unknown) {
    const raw = boundedJson(value);
    assertCurrent();
    await storage.write(raw);
    assertCurrent();
    if ((await read()) !== raw) throw new AppError("storage");
  }
  async function remove() {
    assertCurrent();
    await storage.remove();
    assertCurrent();
    if ((await read()) !== null) throw new AppError("storage");
  }
  const envelope = (record: RecoveryRecord, cleanupPending = false) => ({
    formatVersion: 1,
    ...identity,
    record,
    cleanupPending,
  });
  async function load(): Promise<RecoveryRecord | null> {
    const raw = await read();
    if (raw === null) return null;
    try {
      if (raw.length >= 2048) throw new Error();
      const value: unknown = JSON.parse(raw);
      boundedJson(value);
      if (
        !isRecord(value) ||
        value.formatVersion !== 1 ||
        value.ownerId !== identity.ownerId ||
        value.environment !== identity.environment ||
        typeof value.cleanupPending !== "boolean" ||
        Object.keys(value).some(
          (k) =>
            ![
              "formatVersion",
              "ownerId",
              "environment",
              "record",
              "cleanupPending",
            ].includes(k),
        )
      )
        throw new Error();
      const record = parseRecoveryRecord(value.record, identity);
      if (value.cleanupPending) {
        await remove();
        return null;
      }
      return record;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("storage");
    }
  }
  return {
    load: () => serial(load),
    claim: (value: RecoveryRecord) =>
      serial(async () => {
        const record = parseRecoveryRecord(value, identity),
          old = await load();
        if (old) {
          if (!sameRecoveryIntent(old, record)) throw new AppError("storage");
          return old;
        }
        await write(envelope(record));
        return record;
      }),
    bindId: (key: string, id: string) =>
      serial(async () => {
        const old = await load();
        if (!old || old.key !== key || (old.paymentId && old.paymentId !== id))
          throw new AppError("storage");
        const next = parseRecoveryRecord({ ...old, paymentId: id }, identity);
        await write(envelope(next));
        return next;
      }),
    resolve: (payment: PaymentProjection) =>
      serial(async () => {
        const old = await load();
        if (!old) return;
        if (!correlationResolved(old, payment)) throw new AppError("storage");
        await write(envelope(old, true));
        await remove();
      }),
  };
}
export type CorrelationStore = ReturnType<typeof createCorrelationStore>;
