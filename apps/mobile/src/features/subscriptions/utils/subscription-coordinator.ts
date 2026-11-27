import { AppError } from "@/lib/http/errors";
import type {
  Membership,
  SubscriptionCommand,
  SubscriptionIntent,
} from "../api/subscription-contracts";
import type { SubscriptionStore } from "../storage/subscription-store";

export type SubscriptionState = Readonly<{
  stage: "loading" | "ready" | "pending" | "uncertain" | "unavailable";
  intent?: SubscriptionIntent;
  error?: unknown;
  completed?: boolean;
}>;
// These errors originate before the transaction commits. Auth/network/protocol errors
// may follow a committed charge, so they must retain the original intent.
const rejections = new Set([
  "SUBSCRIPTIONS_DISABLED",
  "SUBSCRIPTION_ALREADY_ACTIVE",
  "SUBSCRIPTION_RENEWAL_PENDING",
  "SUBSCRIPTION_PLAN_CHANGED",
  "SUBSCRIPTION_PLAN_NOT_FOUND",
  "SUBSCRIPTION_NOT_ACTIVE",
  "SUBSCRIPTION_NOT_AN_UPGRADE",
  "SUBSCRIPTION_VERSION_CONFLICT",
  "SUBSCRIPTION_QUOTE_CHANGED",
  "INSUFFICIENT_AVAILABLE_CREDIT",
]);
export class SubscriptionCoordinator {
  private state: SubscriptionState = { stage: "loading" };
  private readonly listeners = new Set<() => void>();
  private store?: SubscriptionStore;
  private busy = false;
  constructor(
    private readonly deps: {
      openStore: () => Promise<SubscriptionStore>;
      send: (intent: SubscriptionIntent) => Promise<Membership>;
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
  private update(state: SubscriptionState) {
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
  async execute(command: SubscriptionCommand) {
    if (this.busy || this.state.stage !== "ready" || !this.deps.isCurrent())
      return;
    return this.dispatch({ key: this.deps.createKey(), command }, false);
  }
  async resume() {
    if (
      this.busy ||
      this.state.stage !== "uncertain" ||
      !this.state.intent ||
      !this.deps.isCurrent()
    )
      return;
    return this.dispatch(this.state.intent, true);
  }
  private async dispatch(intent: SubscriptionIntent, recovering: boolean) {
    if (!this.store) return;
    this.busy = true;
    let saved = recovering;
    let completed = false;
    this.update({ stage: "pending", intent });
    try {
      if (!recovering) {
        await this.store.write(intent);
        saved = true;
      }
      if (!this.deps.isCurrent()) throw new AppError("session");
      const result = await this.deps.send(intent);
      if (!this.deps.isCurrent()) return;
      completed = true;
      this.deps.changed();
      await this.store.remove(intent.key);
      this.update({ stage: "ready", completed: true });
      return this.deps.isCurrent() ? result : undefined;
    } catch (error) {
      if (!this.deps.isCurrent()) return;
      const rejected =
        error instanceof AppError &&
        error.kind === "http" &&
        error.status < 500 &&
        rejections.has(error.code);
      if (saved && !completed && rejected) {
        this.deps.changed();
        try {
          await this.store.remove(intent.key);
          this.update({ stage: "ready", error });
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
