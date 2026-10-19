import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { AppError } from "@/lib/http/errors";
import { createCorrelationStore } from "./correlation-store-core";
import type { PaymentIdentity } from "../utils/payment-recovery-record";

export async function openPaymentStore(
  identity: PaymentIdentity,
  current: () => boolean,
) {
  if (!current() || !(await SecureStore.isAvailableAsync()))
    throw new AppError("storage");
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify([identity.environment, identity.ownerId]),
  );
  if (!current()) throw new AppError("session");
  const key = `skillhub.payment.v1.${digest}`;
  const options = {
    keychainService: "skillhub.payment.v1",
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };
  return createCorrelationStore(
    identity,
    {
      read: () => SecureStore.getItemAsync(key, options),
      write: (value) => SecureStore.setItemAsync(key, value, options),
      remove: () => SecureStore.deleteItemAsync(key, options),
    },
    current,
  );
}
