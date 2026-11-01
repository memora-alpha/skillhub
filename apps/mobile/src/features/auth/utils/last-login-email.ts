import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createLoginEmailPreference } from "./login-email-preference";

const key = "skillhub.auth.last-email.v1";
const options = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const lastLoginEmail = createLoginEmailPreference({
  read: async () =>
    Platform.OS === "web"
      ? globalThis.localStorage.getItem(key)
      : SecureStore.getItemAsync(key, options),
  write: async (email) => {
    if (Platform.OS === "web") globalThis.localStorage.setItem(key, email);
    else await SecureStore.setItemAsync(key, email, options);
  },
});
