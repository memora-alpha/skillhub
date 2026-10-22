import type { WalletScope } from "../../src/features/wallet/types/wallet";
import type {
  ModelDispatch,
  PaymentIntent,
  PreparationSnapshot,
  QuoteModel,
} from "./wallet-model-types";
import { amountHint } from "../../src/features/wallet/utils/topup-policy";
import { reviewTopUp } from "./wallet-model-policy";
import {
  resolveModelCreation,
  unknownCreation,
} from "./wallet-model-intent-result";

const empty = (): PreparationSnapshot =>
  Object.freeze({ stage: "DRAFT", draft: Object.freeze({ amountText: "" }) });
const ended: PreparationSnapshot = Object.freeze({
  stage: "SESSION_ENDED",
  draft: Object.freeze({ amountText: "" }),
});
export function createPaymentPreparation({
  scope,
  isCurrent,
}: {
  scope: WalletScope;
  isCurrent: () => boolean;
}) {
  const owner = Object.freeze({ ...scope });
  let snapshot = empty(),
    quote: QuoteModel | undefined,
    active = true,
    sequence = 0,
    ticket = 0;
  let pending: AbortController | undefined;
  const listeners = new Set<() => void>();
  const current = () => active && isCurrent();
  const publish = (value: PreparationSnapshot) => {
    snapshot = Object.freeze(value);
    for (const listener of listeners) listener();
  };
  const editable = () =>
    current() && ["DRAFT", "REVIEW"].includes(snapshot.stage);
  const unknown = () => publish({ ...snapshot, ...unknownCreation });
  const model = {
    getSnapshot: () => (current() ? snapshot : ended),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    edit: (amountText: string) => {
      if (editable()) {
        quote = undefined;
        publish({ stage: "DRAFT", draft: Object.freeze({ amountText }) });
      }
    },
    setQuoteModel: (value: QuoteModel) => {
      if (editable()) {
        quote = Object.freeze({ ...value });
        publish({ stage: "DRAFT", draft: snapshot.draft });
      }
    },
    review: () => {
      if (!editable()) return false;
      try {
        const review = reviewTopUp(snapshot.draft.amountText, quote);
        publish({ ...snapshot, stage: "REVIEW", review, error: undefined });
        return true;
      } catch {
        publish({
          stage: "DRAFT",
          draft: snapshot.draft,
          error: quote
            ? "Thông tin xác nhận đã thay đổi. Vui lòng xem lại số tiền."
            : amountHint,
        });
        return false;
      }
    },
    backToDraft: () => {
      if (editable()) publish({ stage: "DRAFT", draft: snapshot.draft });
    },
    startNext: () => {
      if (
        current() &&
        ["CREATED_WITH_ID", "REJECTED_WITH_NO_CREATION"].includes(
          snapshot.stage,
        )
      ) {
        quote = undefined;
        publish({ stage: "DRAFT", draft: snapshot.draft });
      }
    },
    async confirmModel(dispatch: ModelDispatch) {
      if (!current() || snapshot.stage !== "REVIEW" || !snapshot.review) return;
      // No idempotency key allocated: local identity has no server recovery meaning.
      const intent: PaymentIntent = Object.freeze({
        localId: `model-intent-${++sequence}`,
        scope: owner,
        review: snapshot.review,
      });
      const controller = new AbortController(),
        started = ++ticket;
      pending = controller;
      publish({ ...snapshot, stage: "CREATING", intent, error: undefined });
      try {
        // A synchronous observer may retire the session during the claim event.
        if (!current() || started !== ticket || controller.signal.aborted)
          return;
        const result = await dispatch(
          intent,
          Object.freeze({
            signal: controller.signal,
            retry: false,
            replayAfterRenewal: false,
          }),
        );
        if (!current() || started !== ticket) return;
        if (controller.signal.aborted) {
          unknown();
          return;
        }
        publish({ ...snapshot, ...resolveModelCreation(result, intent) });
      } catch {
        if (current() && started === ticket) unknown();
      } finally {
        if (pending === controller) pending = undefined;
      }
    },
    interrupt: () => {
      if (current() && snapshot.stage === "CREATING") {
        ticket++;
        pending?.abort();
        pending = undefined;
        unknown();
      }
    },
    dispose: () => {
      active = false;
      ticket++;
      pending?.abort();
      pending = undefined;
      quote = undefined;
      publish(ended);
    },
    activate: () => {
      if (!active && isCurrent()) {
        active = true;
        publish(empty());
      }
    },
  };
  return model;
}
export type PaymentPreparation = ReturnType<typeof createPaymentPreparation>;
