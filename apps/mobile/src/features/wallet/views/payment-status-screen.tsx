import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { ui } from "../components/wallet-ui";
import { PaymentReturnAction } from "../components/payment-action";
import { PaymentStatusPanel } from "../components/payment-status-panel";
import { useWalletBack } from "../hooks/use-wallet-back";
import { useLocalSearchParams } from "expo-router";
import { usePaymentStatus } from "../hooks/use-payment-status";
import { usePaymentReadRefresh } from "../hooks/use-payment-read-refresh";
import {
  paymentStatusId,
  paymentStatusPresentation,
} from "../utils/payment-status-presentation";

export function PaymentStatusPreparationScreen() {
  const back = useWalletBack("status");
  const id = paymentStatusId(useLocalSearchParams());
  const payment = usePaymentStatus(id),
    related = usePaymentReadRefresh(payment.state.data);
  return (
    <AppScreenLayout
      title="Trạng thái thanh toán"
      selected="Hồ sơ"
      back={{ href: "/wallet", label: "Quay lại", onPress: back }}
    >
      {() => (
        <KeyboardFormScrollView contentContainerStyle={ui.page}>
          <PaymentStatusPanel
            compact
            automatic
            watching={payment.watching}
            state={paymentStatusPresentation(payment.state)}
            refresh={related.state}
            onRefresh={payment.state.data ? related.refresh : undefined}
          />
          <PaymentReturnAction
            success={payment.state.data?.status === "PAID"}
          />
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
