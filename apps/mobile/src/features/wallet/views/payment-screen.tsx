import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { Copy, RouteButton, ui } from "@/components/feature-page";
import { PaymentQr } from "../components/payment-qr";
import { useWalletBack } from "../hooks/use-wallet-back";

export function PaymentPreparationScreen() {
  const back = useWalletBack("payment");
  return (
    <AppScreenLayout
      title="Thanh toán"
      selected="Hồ sơ"
      back={{ href: "/wallet/topup", label: "Quay lại", onPress: back }}
    >
      {() => (
        <KeyboardFormScrollView contentContainerStyle={ui.page}>
          <PaymentQr model={{ stage: "unavailable" }} />
          <Copy>
            Thanh toán hiện chưa sẵn sàng. Chưa thể xác nhận kết quả từ liên kết
            hoặc từ việc đóng màn hình.
          </Copy>
          <RouteButton secondary href="/wallet">
            Về ví Credit
          </RouteButton>
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
