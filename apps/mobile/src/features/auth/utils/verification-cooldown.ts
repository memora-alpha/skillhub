import { createStore } from "zustand/vanilla";

export const VERIFICATION_RESEND_SECONDS = 60;

export function remainingCooldownSeconds(deadline: number, now: number) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

type VerificationCooldownState = {
  deadlines: Record<string, number>;
  start: (email: string, now?: number) => void;
  reserve: (email: string, now?: number) => boolean;
};

export function createVerificationCooldownStore() {
  return createStore<VerificationCooldownState>((set, get) => ({
    deadlines: {},
    start: (email, now = Date.now()) => {
      const key = email.trim().toLowerCase();
      set((state) => ({
        deadlines: {
          ...state.deadlines,
          [key]: Math.max(
            state.deadlines[key] ?? 0,
            now + VERIFICATION_RESEND_SECONDS * 1000,
          ),
        },
      }));
    },
    reserve: (email, now = Date.now()) => {
      const key = email.trim().toLowerCase();
      if (remainingCooldownSeconds(get().deadlines[key] ?? 0, now) > 0)
        return false;
      get().start(key, now);
      return true;
    },
  }));
}

// Client-only timestamps survive navigation; the API remains the spam guard.
export const verificationCooldownStore = createVerificationCooldownStore();
export const passwordRecoveryCooldownStore = createVerificationCooldownStore();
