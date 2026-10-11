import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createTokenStore } from "./token-store";

const key = "skillhub.auth.refresh.v1";
const options = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export function createAuthTokenStore() {
  // Browser preview is intentionally memory-only; web auth persistence has no contract yet.
  let webValue: string | null = null;
  return createTokenStore(
    Platform.OS === "web"
      ? {
          read: async () => webValue,
          write: async (value) => {
            webValue = value;
          },
          clear: async () => {
            webValue = null;
          },
        }
      : {
          read: () => SecureStore.getItemAsync(key, options),
          write: (value) => SecureStore.setItemAsync(key, value, options),
          clear: () => SecureStore.deleteItemAsync(key, options),
        },
  );
}
