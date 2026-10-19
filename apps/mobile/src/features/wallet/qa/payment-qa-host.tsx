import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { randomUUID } from "expo-crypto";
import type { PaymentQaBinding } from "@/qa/payment-qa-binding";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { useAuthSession } from "@/features/auth";
import { Button } from "@/components/Button";
import { useQaRuntime } from "./use-qa-runtime";
import { useQaRelatedRefresh } from "./use-qa-related-refresh";
import { openPaymentStore } from "../storage/payment-correlation-store";
import { createPaymentApi } from "../api/payment-api";
import { attachPaymentCreate } from "../context/payment-create-session";
import { PaymentCreatePanel } from "../components/payment-create-panel";
import { PaymentQr } from "../components/payment-qr";
import { PaymentStatusPanel } from "../components/payment-status-panel";
import { paymentStatusPresentation } from "../utils/payment-status-presentation";
import { createPaymentUi } from "../utils/payment-create-ui";
import { Copy, ui } from "../components/wallet-ui";

export function PaymentFinancialQaHost({
  binding,
}: {
  binding: PaymentQaBinding;
}) {
  const runtime = useQaRuntime(binding);
  const { signOut } = useAuthSession();
  const model = useMemo(() => {
    if (!runtime || binding.mode !== "financial") return null;
    const identity = {
      ownerId: runtime.scope.ownerId,
      environment: binding.environment,
    };
    return attachPaymentCreate(runtime, {
      identity,
      api: createPaymentApi(runtime.client),
      newKey: randomUUID,
      openStore: () => openPaymentStore(identity, runtime.isCurrent),
    });
  }, [runtime, binding.mode, binding.environment]);
  return model ? (
    <FinancialBody
      model={model}
      runtime={runtime!}
      binding={binding}
      onExit={() => {
        model.pause();
        void signOut();
      }}
    />
  ) : (
    <Copy>QA thanh toán không khả dụng cho phiên này.</Copy>
  );
}
function FinancialBody({
  model,
  runtime,
  binding,
  onExit,
}: {
  model: NonNullable<ReturnType<typeof attachPaymentCreate>>;
  runtime: NonNullable<ReturnType<typeof useQaRuntime>>;
  binding: PaymentQaBinding;
  onExit: () => void;
}) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const [active, setActive] = useState(AppState.currentState !== "background");
  const related = useQaRelatedRefresh(runtime, state.payment, active),
    view = createPaymentUi(state);
  useEffect(() => {
    model.activate();
    const unregister = runtime.addCleanup(model.dispose);
    if (AppState.currentState !== "background") void model.bootstrap();
    const listener = AppState.addEventListener("change", (next) => {
      setActive(next === "active");
      if (next !== "active") model.pause();
      // Foreground may resume reads, never create/replay.
      else if (model.getSnapshot().paymentId) void model.check();
    });
    return () => {
      listener.remove();
      model.pause();
      unregister();
    };
  }, [model, runtime]);
  return (
    <KeyboardFormScrollView contentContainerStyle={ui.page}>
      <Copy>QA · {binding.buildId} · Thanh toán production vẫn tắt</Copy>
      <PaymentCreatePanel model={model} active={active} />
      {state.payment && (
        <>
          <PaymentQr model={active ? view.qr : { stage: "unavailable" }} />
          <PaymentStatusPanel
            state={paymentStatusPresentation({
              status: state.observation?.stale ? "refresh-error" : "ready",
              data: state.payment,
              stale: !!state.observation?.stale,
            })}
            onCheck={
              active && !state.busy
                ? () => {
                    void model.check();
                  }
                : undefined
            }
            refresh={related.state}
            onRefresh={related.refresh}
          />
        </>
      )}
      <Button variant="ghost" onPress={onExit}>
        Thoát QA và đăng xuất
      </Button>
    </KeyboardFormScrollView>
  );
}
