import type { QueryClient } from "@tanstack/react-query";
import { AppError } from "@/lib/http/errors";
import type {
  WalletCapabilities,
  WalletReadCapability,
  WalletScope,
} from "../types/wallet";
import { walletScopeKey } from "../utils/wallet-query-keys";

// Source-ready is not integrated. All account capabilities stay off during P1.
export const noWalletCapabilities: WalletCapabilities = Object.freeze({
  wallet: false,
  history: false,
  transaction: false,
  quote: false,
  createPayment: false,
  paymentStatus: false,
  recovery: false,
});
export function createWalletRuntime({
  scope,
  queries,
  current,
  capabilities = noWalletCapabilities,
}: {
  scope: WalletScope;
  queries: QueryClient;
  current: () => boolean;
  capabilities?: WalletCapabilities;
}) {
  const owner = Object.freeze({ ...scope });
  const key = walletScopeKey(owner);
  const configured = Object.freeze({ ...capabilities });
  const sessionData = new Map<string, unknown>();
  const pending = new Map<
    string,
    { controller: AbortController; detach: () => void }
  >();
  const tickets = new Map<string, number>();
  const cleanups = new Set<() => void>();
  let active = true,
    lifetime = 0;
  const isCurrent = () => active && current();
  const assertCurrent = () => {
    if (!isCurrent()) throw new AppError("session");
  };
  function dispose() {
    if (!active) return;
    active = false;
    lifetime++;
    for (const lease of pending.values()) {
      lease.detach();
      lease.controller.abort();
    }
    pending.clear();
    tickets.clear();
    sessionData.clear();
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch {
        // A faulty observer must not prevent other listeners/cache being cleared.
      }
    }
    cleanups.clear();
    void queries.cancelQueries({ queryKey: key });
    queries.removeQueries({ queryKey: key });
  }
  async function read<T>(
    capability: WalletReadCapability,
    resource: string,
    load: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    assertCurrent();
    if (!configured[capability]) throw new AppError("config");
    if (signal?.aborted) throw new AppError("session");
    const resourceKey = `${capability}:${resource}`;
    const ticket = (tickets.get(resourceKey) ?? 0) + 1;
    tickets.set(resourceKey, ticket);
    const previous = pending.get(resourceKey);
    previous?.detach();
    previous?.controller.abort();
    const controller = new AbortController(),
      startedIn = lifetime;
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const detach = () => signal?.removeEventListener("abort", abort);
    pending.set(resourceKey, { controller, detach });
    const assertObservation = () => {
      assertCurrent();
      if (
        startedIn !== lifetime ||
        controller.signal.aborted ||
        tickets.get(resourceKey) !== ticket
      )
        throw new AppError("session");
    };
    try {
      const value = await load(controller.signal);
      assertObservation();
      return value;
    } catch (error) {
      // Neither old success nor old failure is allowed to affect a new scope.
      assertObservation();
      throw error;
    } finally {
      detach();
      if (pending.get(resourceKey)?.controller === controller)
        pending.delete(resourceKey);
    }
  }
  return {
    scope: owner,
    key,
    capabilities: configured,
    sessionData,
    isCurrent,
    read,
    dispose,
    activate: () => {
      if (current() && !active) {
        lifetime++;
        active = true;
      }
    },
    addCleanup: (cleanup: () => void) => {
      if (isCurrent()) cleanups.add(cleanup);
      else cleanup();
      return () => {
        cleanups.delete(cleanup);
      };
    },
  };
}
export type WalletRuntime = ReturnType<typeof createWalletRuntime>;
