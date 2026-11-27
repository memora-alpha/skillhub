import * as SecureStore from "expo-secure-store";
import { digestStringAsync, CryptoDigestAlgorithm } from "expo-crypto";
import { AppError } from "@/lib/http/errors";
import { parse } from "@/lib/http/contracts";
import { intentSchema } from "../api/subscription-contracts";
import type { SubscriptionStore } from "./subscription-store";

const queues = new Map<string, Promise<unknown>>();
function serialized<T>(key: string, work: () => Promise<T>): Promise<T> {
  const next = (queues.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(work);
  queues.set(key, next);
  void next
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    })
    .catch(() => undefined);
  return next;
}
export async function openSubscriptionStore(
  owner: string,
  environment: string,
): Promise<SubscriptionStore> {
  if (!(await SecureStore.isAvailableAsync())) throw new AppError("storage");
  const digest = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    JSON.stringify([owner, environment]),
  );
  const key = `skillhub.subscription.v1.${digest}`;
  const options = {
    keychainService: "skillhub.subscription.v1",
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };
  const read = async () => {
    try {
      const value = await SecureStore.getItemAsync(key, options);
      return value === null ? null : parse(intentSchema, JSON.parse(value));
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
        await SecureStore.setItemAsync(
          key,
          JSON.stringify(parse(intentSchema, intent)),
          options,
        );
      }),
    remove: (expectedKey) =>
      serialized(key, async () => {
        if ((await read())?.key === expectedKey)
          await SecureStore.deleteItemAsync(key, options);
      }),
  };
}
