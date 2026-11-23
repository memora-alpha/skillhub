import * as SecureStore from "expo-secure-store";
import { digestStringAsync, CryptoDigestAlgorithm } from "expo-crypto";
import { AppError } from "@/lib/http/errors";
import { parse } from "@/lib/http/contracts";
import { redemptionIntentSchema } from "../api/reward-contracts";
import type { RedemptionStore } from "./redemption-store";

// Serialize record updates across overlapping account generations for the same owner.
const queues = new Map<string, Promise<unknown>>();
function serialized<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(work);
  queues.set(key, next);
  void next
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    })
    .catch(() => undefined);
  return next;
}

export async function openRedemptionStore(
  ownerId: string,
  environment: string,
): Promise<RedemptionStore> {
  if (!(await SecureStore.isAvailableAsync())) throw new AppError("storage");
  const digest = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    JSON.stringify([ownerId, environment]),
  );
  const key = `skillhub.voucher.v1.${digest}`;
  const options = {
    keychainService: "skillhub.voucher.v1",
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };
  const read = async () => {
    try {
      const text = await SecureStore.getItemAsync(key, options);
      return text === null
        ? null
        : parse(redemptionIntentSchema, JSON.parse(text));
    } catch {
      throw new AppError("storage");
    }
  };
  return {
    read: () => serialized(key, read),
    write: (intent) =>
      serialized(key, async () => {
        const previous = await read();
        if (previous && JSON.stringify(previous) !== JSON.stringify(intent))
          throw new AppError("storage");
        await SecureStore.setItemAsync(key, JSON.stringify(intent), options);
      }),
    remove: (expectedKey) =>
      serialized(key, async () => {
        const previous = await read();
        if (previous?.key === expectedKey)
          await SecureStore.deleteItemAsync(key, options);
      }),
  };
}
