import { AppScreenLayout } from "@/features/shell";
import { View } from "react-native";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { Copy, Panel, RouteButton, ui } from "../components/wallet-ui";
import { PaymentCreatePanel } from "../components/payment-create-panel";
import { PaymentCheckout } from "../components/payment-checkout";
import { checkoutStyles } from "../components/payment-checkout.styles";
import { SimplePaymentStatus } from "../components/simple-payment-status";
import { PaymentReturnAction } from "../components/payment-action";
import { PaymentCancelAction } from "../components/payment-cancel-action";
import { useOwnerPaymentCreate } from "../hooks/use-owner-payment-create";
import { usePaymentReadRefresh } from "../hooks/use-payment-read-refresh";
import { useWalletBack } from "../hooks/use-wallet-back";
import { createPaymentUi } from "../utils/payment-create-ui";
import { paymentStatusPresentation } from "../utils/payment-status-presentation";
import { paymentPalette } from "../components/wallet-payment-palette";

export function PaymentPreparationScreen() {
  const { model, state, active, isActive, watching } = useOwnerPaymentCreate({
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
      title="Thanh toán QR"
      contentStyle={{ backgroundColor: paymentPalette.background }}
      selected="Hồ sơ"
      back={{ href: "/wallet", label: "Quay lại", onPress: back }}
    >
      {() => (
        <KeyboardFormScrollView
          contentContainerStyle={[ui.page, checkoutStyles.page]}
        >
          {retained ? (
            <>
              {!state.payment && (
                <PaymentCreatePanel
                  model={model}
                  active={active}
                  mode="account"
                  showStatusCheck={false}
                />
              )}
              {state.payment &&
                (["CREATED", "PENDING"].includes(state.payment.status) ? (
                  <PaymentCheckout
                    payment={state.payment}
                    qr={view.qr}
                    active={active}
                    watching={watching}
                    stale={!!state.observation?.stale}
                    cancelUnconfirmed={state.cancelUnconfirmed}
                  />
                ) : (
                  <SimplePaymentStatus
                    automatic
                    watching={watching}
                    busy={state.busy}
                    state={paymentStatusPresentation({
                      status: state.observation?.stale
                        ? "refresh-error"
                        : "ready",
                      data: state.payment,
                      stale: !!state.observation?.stale,
                    })}
                    refresh={related.state}
                    onRefresh={active ? related.refresh : undefined}
                  />
                ))}
            </>
          ) : (
            <Panel title="Chưa có yêu cầu thanh toán">
              <Copy>Chọn số tiền bạn muốn nạp để tạo mã QR thanh toán.</Copy>
              <RouteButton href="/wallet/topup">Nạp Credit</RouteButton>
            </Panel>
          )}
          <View style={checkoutStyles.actions}>
            {model && (
              <PaymentCancelAction
                key={state.paymentId}
                state={state}
                active={active}
                onCancel={() => {
                  if (isActive()) void model.cancel();
                }}
              />
            )}
            <PaymentReturnAction success={state.payment?.status === "PAID"} />
          </View>
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
