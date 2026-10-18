import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { Copy, RouteButton, ui } from "../components/wallet-ui";
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
            state={paymentStatusPresentation(payment.state)}
            onCheck={
              payment.check
                ? () => {
                    void payment.check?.();
                  }
                : undefined
            }
            refresh={related.state}
            onRefresh={payment.state.data ? related.refresh : undefined}
          />
          {!["PAID", "REFUNDED"].includes(payment.state.data?.status ?? "") && (
            <Copy muted>
              Nếu lần nạp trước chưa rõ kết quả, không tạo lại yêu cầu. Hiện
              chưa thể khôi phục hoặc đối chiếu yêu cầu sau khi kết thúc phiên.
            </Copy>
          )}
          <RouteButton secondary href="/wallet">
            Về ví Credit
          </RouteButton>
          <RouteButton secondary href="/wallet/history">
            Lịch sử giao dịch
          </RouteButton>
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
