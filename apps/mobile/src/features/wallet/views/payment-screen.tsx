import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { Copy, Panel, RouteButton, ui } from "../components/wallet-ui";
import { PaymentCreatePanel } from "../components/payment-create-panel";
import { PaymentQr } from "../components/payment-qr";
import { SimplePaymentStatus } from "../components/simple-payment-status";
import { PaymentReturnAction } from "../components/payment-action";
import { useOwnerPaymentCreate } from "../hooks/use-owner-payment-create";
import { usePaymentReadRefresh } from "../hooks/use-payment-read-refresh";
import { useWalletBack } from "../hooks/use-wallet-back";
import { createPaymentUi } from "../utils/payment-create-ui";
import { paymentStatusPresentation } from "../utils/payment-status-presentation";

export function PaymentPreparationScreen() {
  const { model, state, active, watching } = useOwnerPaymentCreate({
    observe: true,
  });
  const back = useWalletBack(
    "payment",
    state.busy && state.stage === "claiming",
  );
  const related = usePaymentReadRefresh(state.payment),
    view = createPaymentUi(state);
  const retained =
    !!model &&
    (["loading", "unknown", "known", "blocked"].includes(state.stage) ||
      state.busy);
  return (
    <AppScreenLayout
      title="Thanh toán"
      selected="Hồ sơ"
      back={{ href: "/wallet", label: "Quay lại", onPress: back }}
    >
      {() => (
        <KeyboardFormScrollView contentContainerStyle={ui.page}>
          {retained ? (
            <>
              {!state.payment && (
                <PaymentCreatePanel
                  model={model}
                  active={active}
                  mode="account"
                />
              )}
              {state.payment && (
                <>
                  <SimplePaymentStatus
                    automatic
                    watching={watching}
                    busy={state.busy}
                    hasQr={active && view.qr.stage === "ready-model"}
                    state={paymentStatusPresentation({
                      status: state.observation?.stale
                        ? "refresh-error"
                        : "ready",
                      data: state.payment,
                      stale: !!state.observation?.stale,
                    })}
                    refresh={related.state}
                    onRefresh={active ? related.refresh : undefined}
                  >
                    {active && view.qr.stage === "ready-model" && (
                      <PaymentQr model={view.qr} minimal />
                    )}
                  </SimplePaymentStatus>
                </>
              )}
            </>
          ) : (
            <Panel title="Chưa có yêu cầu thanh toán">
              <Copy>
                Chọn số tiền và xác nhận nạp Credit trước khi xem mã QR. Liên
                kết hoặc việc quay lại ứng dụng không xác nhận thanh toán.
              </Copy>
              <RouteButton href="/wallet/topup">Nạp Credit</RouteButton>
            </Panel>
          )}
          <PaymentReturnAction success={state.payment?.status === "PAID"} />
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
