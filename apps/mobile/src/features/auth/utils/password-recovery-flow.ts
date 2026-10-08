import { createStore } from "zustand/vanilla";
import {
  forgotPasswordSchema,
  recoveryCodeSchema,
} from "../schemas/auth-schemas";

type RecoveryDraft = { email: string; otpCode: string | null };
type PasswordRecoveryState = {
  draft: RecoveryDraft | null;
  begin: (email: string) => boolean;
  setCode: (otpCode: string) => boolean;
  clearCode: () => void;
  clear: () => void;
};

export function createPasswordRecoveryStore() {
  return createStore<PasswordRecoveryState>((set, get) => ({
    draft: null,
    begin: (email) => {
      const result = forgotPasswordSchema.safeParse({ email });
      if (!result.success) {
        set({ draft: null });
        return false;
      }
      set({ draft: { email: result.data.email.toLowerCase(), otpCode: null } });
      return true;
    },
    setCode: (otpCode) => {
      const draft = get().draft;
      if (!draft || !recoveryCodeSchema.safeParse({ otpCode }).success)
        return false;
      set({ draft: { ...draft, otpCode } });
      return true;
    },
    clearCode: () => {
      const draft = get().draft;
      if (draft) set({ draft: { ...draft, otpCode: null } });
    },
    clear: () => set({ draft: null }),
  }));
}

// This draft is not verification proof. V1 consumes the OTP only at reset.
// Keep it in memory only, never in route params or persistent storage.
export const passwordRecoveryStore = createPasswordRecoveryStore();
