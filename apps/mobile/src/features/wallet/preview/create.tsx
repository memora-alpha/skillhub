import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/Button";
import { Copy } from "../components/wallet-ui";
import { PaymentCreatePanel } from "../components/payment-create-panel";
import { PaymentQr } from "../components/payment-qr";
import { PaymentStatusPanel } from "../components/payment-status-panel";
import { paymentStatusPresentation } from "../utils/payment-status-presentation";
import { createPaymentUi } from "../utils/payment-create-ui";
import { createInertTopupHost } from "./create-host";
import { AccountTopupPanel } from "../components/account-topup-panel";
import { SimplePaymentStatus } from "../components/simple-payment-status";
import { usePaymentAutoRead } from "../hooks/use-payment-auto-read";

export function WalletCreatePreview() {
  const host = useMemo(createInertTopupHost, []);
  const [simple, setSimple] = useState(false);
  const [session, setSession] = useState(host.createModel);
  const model = session.model,
    state = useSyncExternalStore(
      model.subscribe,
      model.getSnapshot,
      model.getSnapshot,
    );
  useEffect(() => {
    session.activate();
    model.activate();
    void model.bootstrap();
    return () => session.dispose();
  }, [session, model]);
  const view = createPaymentUi(state),
    counts = host.counts();
  const watching = usePaymentAutoRead({
    active: simple,
    id: state.paymentId,
    current: () => model.getSnapshot().stage !== "ended",
    snapshot: () => ({
      id: model.getSnapshot().paymentId,
      status: model.getSnapshot().payment?.status,
      stale: !!model.getSnapshot().observation?.stale,
      denied: model.getSnapshot().readDenied,
    }),
    read: model.check,
  });
  return (
    <>
      <Copy>
        PREVIEW CREATE · DỮ LIỆU MẪU · KHÔNG THANH TOÁN · KHÔNG LƯU THIẾT BỊ
      </Copy>
      <Copy>
        Intent mẫu: {counts.intents} · Create boundary: {counts.createCalls} ·
        GET mẫu: {counts.ownerReads}
      </Copy>
      <Button variant="paper" onPress={() => setSimple((value) => !value)}>
        {simple ? "Xem giao diện kiểm thử" : "Xem giao diện thanh toán gọn"}
      </Button>
      {simple ? (
        <>
          {!state.payment && (
            <AccountTopupPanel model={model} state={state} active />
          )}
          {state.payment && (
            <SimplePaymentStatus
              automatic
              watching={watching}
              busy={state.busy}
              hasQr={view.qr.stage === "ready-model"}
              state={paymentStatusPresentation({
                status: state.observation?.stale ? "refresh-error" : "ready",
                data: state.payment,
                stale: !!state.observation?.stale,
              })}
              onCheck={
                !state.busy
                  ? () => {
                      void model.check();
                    }
                  : undefined
              }
            >
              {view.qr.stage === "ready-model" && (
                <PaymentQr model={view.qr} minimal synthetic />
              )}
            </SimplePaymentStatus>
          )}
        </>
      ) : (
        <PaymentCreatePanel model={model} active synthetic />
      )}
      {!simple && state.payment && (
        <>
          <PaymentQr model={view.qr} synthetic />
          <PaymentStatusPanel
            state={paymentStatusPresentation({
              status: state.observation?.stale ? "refresh-error" : "ready",
              data: state.payment,
              stale: !!state.observation?.stale,
            })}
            onCheck={
              !state.busy
                ? () => {
                    void model.check();
                  }
                : undefined
            }
          />
        </>
      )}
      {[
        "timeout",
        "ok",
        "hidden",
        "review",
        "paid",
        "policy-block",
        "created",
      ].map((mode) => (
        <Button key={mode} variant="ghost" onPress={() => host.setMode(mode)}>
          Fixture: {mode}
        </Button>
      ))}
      <Button
        variant="paper"
        onPress={() => {
          session.dispose();
          setSession(host.createModel());
        }}
      >
        Remount model · không phải restart
      </Button>
      <Button
        variant="paper"
        onPress={() => {
          model.pause();
        }}
      >
        Background mẫu
      </Button>
      <Button
        variant="paper"
        onPress={() => {
          model.back();
        }}
      >
        Back mẫu · giữ số tiền
      </Button>
    </>
  );
}
