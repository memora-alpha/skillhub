import { useEffect } from "react";
import { useChatEvents } from "@/features/messages";
import { createPaymentEventReader } from "../utils/payment-events";
import type { PaymentCoordinator } from "../utils/payment-create-coordinator";

export function usePaymentEvents({
  active,
  ownerId,
  id,
  model,
  current,
}: {
  active: boolean;
  ownerId?: string;
  id?: string;
  model: PaymentCoordinator | null;
  current: () => boolean;
}) {
  const { subscribe, connected } = useChatEvents();
  useEffect(() => {
    if (!active || !ownerId || !id || !model) return;
    const control = new AbortController();
    const receive = createPaymentEventReader({
      ownerId,
      current: () => !control.signal.aborted && current(),
      snapshot: model.getSnapshot,
      read: () => model.check(true),
    });
    const unsubscribe = subscribe((frame, signal) => receive(frame, signal));
    // Cover a ready event emitted before this focused screen subscribed.
    // The coordinator retains errors for the polling fallback; catch-up runs
    // outside the stream's own error/reconnect handler.
    void receive({ event: "stream.ready", data: "{}" }, control.signal).catch(
      () => {},
    );
    return () => {
      control.abort();
      unsubscribe();
    };
  }, [active, ownerId, id, model, current, subscribe]);
  return connected;
}
