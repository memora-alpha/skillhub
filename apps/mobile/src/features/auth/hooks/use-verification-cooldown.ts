import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useStore } from "zustand";
import {
  remainingCooldownSeconds,
  passwordRecoveryCooldownStore,
  verificationCooldownStore,
} from "../utils/verification-cooldown";

export function useVerificationCooldown(
  email: string,
  initiallySent: boolean,
  purpose: "verification" | "recovery" = "verification",
) {
  const store =
    purpose === "recovery"
      ? passwordRecoveryCooldownStore
      : verificationCooldownStore;
  const key = email.trim().toLowerCase();
  const deadline = useStore(store, (state) => state.deadlines[key]);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (key && initiallySent && store.getState().deadlines[key] === undefined)
      store.getState().start(key);
  }, [key, initiallySent, store]);

  useEffect(() => {
    setNow(Date.now());
    if (!deadline || deadline <= Date.now()) return;
    const refresh = () => setNow(Date.now());
    const timer = setInterval(() => {
      refresh();
      if (Date.now() >= deadline) clearInterval(timer);
    }, 250);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [deadline]);

  return {
    seconds: remainingCooldownSeconds(deadline ?? 0, now),
    reserve: () => store.getState().reserve(key),
  };
}
