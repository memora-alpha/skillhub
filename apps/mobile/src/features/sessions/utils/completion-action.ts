import { AppError } from "@/lib/http/errors";
import type { SessionsApi } from "../api/sessions-api";
import type { CompletionReceipt, LearningSession } from "../types";
import { canConfirmSession, ownConfirmation } from "./session-policy";

type ActionState = {
  pending: boolean;
  blocked: boolean;
  error?: unknown;
  receipt?: CompletionReceipt;
  detail?: LearningSession;
};
type Options = {
  api: SessionsApi;
  userId: string;
  sessionId: string;
  isCurrent: () => boolean;
  now?: () => number;
  onDetail: (detail: LearningSession) => Promise<void>;
};
export function createCompletionAction(options: Options) {
  let state: ActionState = { pending: false, blocked: false };
  let active = true;
  const listeners = new Set<() => void>();
  const current = () => active && options.isCurrent();
  const update = (patch: Partial<ActionState>) => {
    if (!current()) return;
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  async function read() {
    const detail = await options.api.detail(options.sessionId);
    if (!current()) throw new AppError("session");
    await options.onDetail(detail);
    if (!current()) throw new AppError("session");
    return detail;
  }
  return {
    getSnapshot: () => state,
    setActive(value: boolean) {
      active = value;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async run() {
      if (!current() || state.pending || state.blocked || state.receipt) return;
      update({ pending: true, error: undefined });
      try {
        const initial = await options.api.detail(options.sessionId);
        if (!current()) return;
        if (
          !canConfirmSession(
            initial,
            options.userId,
            (options.now ?? Date.now)(),
          )
        ) {
          if (ownConfirmation(initial, options.userId) === "CONFIRMED") {
            await options.onDetail(initial);
            update({ detail: initial, blocked: true });
            return;
          }
          throw new AppError("http", 409, "SESSION_CANNOT_BE_COMPLETED");
        }
        const receipt = await options.api.complete(options.sessionId);
        update({ receipt, blocked: true });
        if (!current()) return;
        const detail = await read();
        update({ detail });
      } catch (error) {
        update({ error, blocked: true });
      } finally {
        update({ pending: false });
      }
    },
    async refresh() {
      if (!current() || state.pending) return;
      update({ pending: true, error: undefined });
      try {
        const detail = await read();
        update({
          detail,
          blocked:
            !!state.receipt ||
            !canConfirmSession(
              detail,
              options.userId,
              (options.now ?? Date.now)(),
            ),
        });
      } catch (error) {
        update({ error, blocked: true });
      } finally {
        update({ pending: false });
      }
    },
  };
}
