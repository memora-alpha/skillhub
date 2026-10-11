import { createStore } from "zustand/vanilla";
import { forgotPasswordSchema } from "../schemas/auth-schemas";
import {
  parsePasswordResetProof,
  type PasswordResetProof,
} from "../api/auth-contracts";

type RecoveryDraft = { email: string; proof: PasswordResetProof | null };
type PasswordRecoveryState = {
  draft: RecoveryDraft | null;
  begin: (email: string) => boolean;
  authorize: (email: string, proof: PasswordResetProof) => boolean;
  clearProof: () => void;
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
      set({
        draft: { email: result.data.email.toLowerCase(), proof: null },
      });
      return true;
    },
    authorize: (email, proof) => {
      const draft = get().draft;
      if (!draft || draft.email !== email.trim().toLowerCase()) return false;
      try {
        const parsed = parsePasswordResetProof(proof);
        if (Date.parse(parsed.expiresAt) <= Date.now()) return false;
        set({ draft: { ...draft, proof: parsed } });
        return true;
      } catch {
        return false;
      }
    },
    clearProof: () => {
      const draft = get().draft;
      if (draft) set({ draft: { ...draft, proof: null } });
    },
    clear: () => set({ draft: null }),
  }));
}

// Reset credentials stay in memory, never in route params or persistent storage.
export const passwordRecoveryStore = createPasswordRecoveryStore();
