import { createStore } from "zustand/vanilla";
import { forgotPasswordSchema } from "../schemas/auth-schemas";
import {
  parsePasswordResetProof,
  type PasswordResetProof,
} from "../api/auth-contracts";
import type { SessionController } from "../context/session-controller";

type RecoveryDraft = { email: string; proof: PasswordResetProof | null };
type PasswordRecoveryState = {
  draft: RecoveryDraft | null;
  ownerGeneration: number | null;
  begin: (email: string, ownerGeneration?: number | null) => boolean;
  authorize: (email: string, proof: PasswordResetProof) => boolean;
  clearProof: () => void;
  clear: () => void;
};

export function createPasswordRecoveryStore() {
  return createStore<PasswordRecoveryState>((set, get) => ({
    draft: null,
    ownerGeneration: null,
    begin: (email, ownerGeneration = null) => {
      const result = forgotPasswordSchema.safeParse({ email });
      if (!result.success) {
        set({ draft: null, ownerGeneration: null });
        return false;
      }
      set({
        draft: { email: result.data.email.toLowerCase(), proof: null },
        ownerGeneration,
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
    clear: () => set({ draft: null, ownerGeneration: null }),
  }));
}

// Reset credentials stay in memory, never in route params or persistent storage.
export const passwordRecoveryStore = createPasswordRecoveryStore();

// Subscribe outside SessionGate so cleanup also runs while recovery screens are unmounted.
export function bindPasswordRecoverySession(
  session: Pick<SessionController, "generation" | "subscribe" | "getSnapshot">,
  store = passwordRecoveryStore,
) {
  const sync = () => {
    const owner = store.getState().ownerGeneration;
    if (
      owner !== null &&
      (owner !== session.generation || session.getSnapshot() !== "ready")
    )
      store.getState().clear();
  };
  sync();
  return session.subscribe(sync);
}
