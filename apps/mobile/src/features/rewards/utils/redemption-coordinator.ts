import { AppError } from "@/lib/http/errors";
import { isRejectedCommand } from "@/lib/http/command-intent";
import type {
  Redemption,
  RedemptionIntent,
  RewardProduct,
} from "../api/reward-contracts";
import type { RedemptionStore } from "../storage/redemption-store";

export type RedemptionState = Readonly<{
  stage: "loading" | "ready" | "pending" | "uncertain" | "unavailable";
  intent?: RedemptionIntent;
  error?: unknown;
  notice?: "not-redeemed";
}>;
export class RedemptionCoordinator {
  private state: RedemptionState = { stage: "loading" };
  private readonly listeners = new Set<() => void>();
  private store?: RedemptionStore;
  private busy = false;
  constructor(
    private readonly deps: {
      openStore: () => Promise<RedemptionStore>;
      send: (intent: RedemptionIntent) => Promise<Redemption>;
      lookup: (intent: RedemptionIntent) => Promise<Redemption | null>;
      createKey: () => string;
      isCurrent: () => boolean;
      changed: () => void;
    },
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(state: RedemptionState) {
    if (!this.deps.isCurrent()) return;
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  async load() {
    if (this.busy || !this.deps.isCurrent()) return;
    this.busy = true;
    this.update({ stage: "loading" });
    try {
      this.store = await this.deps.openStore();
      const intent = await this.store.read();
      this.update(intent ? { stage: "uncertain", intent } : { stage: "ready" });
    } catch (error) {
      this.update({ stage: "unavailable", error });
    } finally {
      this.busy = false;
    }
  }
  async redeem(product: RewardProduct) {
    if (this.busy || this.state.stage !== "ready" || !this.deps.isCurrent())
      return;
    return this.dispatch({
      key: this.deps.createKey(),
      productId: product.id,
      expectedPriceVersion: product.priceVersion,
    });
  }
  async recover() {
    if (
      this.busy ||
      !this.store ||
      this.state.stage !== "uncertain" ||
      !this.state.intent ||
      !this.deps.isCurrent()
    )
      return;
    const intent = this.state.intent;
    this.busy = true;
    this.update({ stage: "pending", intent });
    try {
      const result = await this.deps.lookup(intent);
      if (!this.deps.isCurrent()) return;
      // Refresh current prices and wallet after either authoritative outcome.
      this.deps.changed();
      await this.store.remove(intent.key);
      this.update({
        stage: "ready",
        notice: result ? undefined : "not-redeemed",
      });
      return this.deps.isCurrent() ? (result ?? undefined) : undefined;
    } catch (error) {
      this.update({ stage: "uncertain", intent, error });
    } finally {
      this.busy = false;
    }
  }
  private async dispatch(intent: RedemptionIntent) {
    if (!this.store) return;
    this.busy = true;
    let saved = false;
    let completed = false;
    this.update({ stage: "pending", intent });
    try {
      // Save before the first POST; interrupted writes never send a debit.
      await this.store.write(intent);
      saved = true;
      if (!this.deps.isCurrent()) throw new AppError("session");
      const result = await this.deps.send(intent);
      if (!this.deps.isCurrent()) throw new AppError("session");
      completed = true;
      this.deps.changed();
      // A failed cleanup preserves the key for lookup recovery.
      await this.store.remove(intent.key);
      this.update({ stage: "ready" });
      return this.deps.isCurrent() ? result : undefined;
    } catch (error) {
      if (!this.deps.isCurrent()) return;
      if (saved && !completed && isRejectedCommand(error)) {
        try {
          await this.store.remove(intent.key);
          this.update({ stage: "ready", intent, error });
        } catch {
          this.update({ stage: "uncertain", intent, error });
        }
      } else if (saved) this.update({ stage: "uncertain", intent, error });
      else
        this.update({ stage: "unavailable", error: new AppError("storage") });
    } finally {
      this.busy = false;
    }
  }
}
