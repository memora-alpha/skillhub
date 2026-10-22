import { AppError } from "@/lib/http/errors";
import { parseCreationPolicy } from "../schemas/payment-contracts";
import { detachPaymentQr } from "./payment-observation";
import { isTerminalPaymentStatus } from "./payment-outcome";
import type {
  PaymentCoordinatorOptions,
  PaymentCreateSnapshot,
  PaymentCreatePrivate,
} from "./payment-create-state";

export function createPaymentCreateRuntime(input: PaymentCoordinatorOptions) {
  const options = {
    ...input,
    identity: Object.freeze({ ...input.identity }),
    scope: Object.freeze({ ...input.scope }),
  };
  if (options.identity.ownerId !== options.scope.ownerId)
    throw new AppError("config");
  let snapshot: PaymentCreateSnapshot = Object.freeze({
    stage: "loading",
    draft: "",
    busy: false,
  });
  const state: PaymentCreatePrivate = { storeVerified: false, incident: false };
  let active = true,
    ticket = 0,
    pending: Promise<void> | undefined,
    pendingKind: "command" | "read" | "cancel" | undefined,
    finishPending: (() => void) | undefined,
    controller: AbortController | undefined;
  const listeners = new Set<() => void>();
  const current = () => active && options.current();
  const publish = (change: Partial<PaymentCreateSnapshot>) => {
    const next = { ...snapshot, ...change };
    snapshot = Object.freeze({
      ...next,
      readTargetId:
        next.paymentId ??
        (next.stage === "blocked" && !state.record && !state.incident
          ? (next.policy?.existingPaymentId ?? undefined)
          : undefined),
      canRestore:
        !pending &&
        !state.storeVerified &&
        !state.incident &&
        !next.paymentId &&
        ["blocked", "unknown"].includes(next.stage),
      canStartNext:
        !pending &&
        state.storeVerified &&
        !state.record &&
        !state.incident &&
        next.stage === "known" &&
        !!next.payment &&
        !next.observation?.stale &&
        !next.payment.recoveryRequired &&
        next.payment.recoveryReason === null &&
        isTerminalPaymentStatus(next.payment.status),
      canCancel:
        (!pending || pendingKind === "read") &&
        !!options.api.cancel &&
        !state.incident &&
        !next.readDenied &&
        next.stage === "known" &&
        next.payment?.gateway === "PAYOS" &&
        ["CREATED", "PENDING"].includes(next.payment.status) &&
        (!next.observation?.stale || !!next.cancelUnconfirmed),
      canReplay:
        !pending &&
        state.storeVerified &&
        !!state.record &&
        !state.record.paymentId &&
        !state.incident &&
        next.stage === "unknown",
      canReturnToDraft:
        !pending &&
        state.storeVerified &&
        !state.record &&
        !state.incident &&
        ["review", "blocked"].includes(next.stage),
    });
    for (const listener of listeners) listener();
  };
  function run(
    work: (signal: AbortSignal, valid: () => void) => Promise<void>,
    kind: "command" | "read" | "cancel" = "command",
    afterCurrent = false,
  ): Promise<void> {
    if (!current()) return Promise.resolve();
    if (pending) {
      if (kind === "read" && afterCurrent) {
        const started = ticket;
        return pending.then(() => {
          if (current() && started === ticket) return run(work, "read");
        });
      }
      if (kind === "read" || pendingKind !== "read") return pending;
      // An explicit command takes priority over a replaceable GET. Do not use
      // pause(): it detaches the QR and would make a read look like a reload.
      ticket++;
      controller?.abort();
      finishPending?.();
    }
    const started = ++ticket,
      abort = new AbortController();
    controller = abort;
    const valid = () => {
      if (!current() || started !== ticket || abort.signal.aborted)
        throw new AppError("session");
    };
    let finish: () => void = () => {};
    const lease = new Promise<void>((resolve) => {
      finish = resolve;
    });
    // Publish only after synchronously claiming the shared lease.
    pending = lease;
    pendingKind = kind;
    finishPending = finish;
    publish({
      busy: true,
      checking: kind === "read",
      cancelling: kind === "cancel",
    });
    void (async () => {
      try {
        valid();
        await work(abort.signal, valid);
      } catch {
        if (current() && started === ticket)
          publish({
            stage: "blocked",
            notice:
              "Chưa thể khôi phục yêu cầu. Vui lòng thử lại sau; không tạo yêu cầu mới.",
          });
      } finally {
        if (pending === lease) {
          pending = undefined;
          pendingKind = undefined;
          finishPending = undefined;
        }
        if (controller === abort) controller = undefined;
        if (current() && started === ticket)
          publish({ busy: false, checking: false, cancelling: false });
        finish();
      }
    })();
    return lease;
  }
  return {
    options,
    state,
    current,
    publish,
    run,
    snapshot: () => snapshot,
    ticket: () => ticket,
    pending: () => !!pending,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    policy: async (signal: AbortSignal, valid: () => void) => {
      const value = parseCreationPolicy(
        await options.api.creationPolicy(signal),
      );
      valid();
      publish({ policy: value });
      return value;
    },
    pause: () => {
      if (!current()) return;
      ticket++;
      controller?.abort();
      controller = undefined;
      finishPending?.();
      finishPending = undefined;
      pending = undefined;
      pendingKind = undefined;
      const observation = snapshot.observation
        ? detachPaymentQr(snapshot.observation)
        : undefined;
      publish({
        busy: false,
        checking: false,
        cancelling: false,
        stage: state.record && !snapshot.paymentId ? "unknown" : snapshot.stage,
        observation,
        payment: observation?.data,
      });
    },
    dispose: () => {
      active = false;
      ticket++;
      controller?.abort();
      controller = undefined;
      finishPending?.();
      finishPending = undefined;
      pending = undefined;
      pendingKind = undefined;
      state.record = undefined;
      state.store = undefined;
      snapshot = Object.freeze({ stage: "ended", draft: "", busy: false });
      for (const listener of listeners) listener();
    },
    activate: () => {
      if (!active && options.current()) {
        active = true;
        state.storeVerified = false;
        publish({
          stage: state.incident ? "blocked" : "loading",
          draft: "",
          busy: false,
        });
      }
    },
  };
}
export type PaymentCreateRuntime = ReturnType<
  typeof createPaymentCreateRuntime
>;
