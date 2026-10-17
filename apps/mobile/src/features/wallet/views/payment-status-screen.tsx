import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { Copy, RouteButton, ui } from "@/components/feature-page";
import { PaymentStatusPanel } from "../components/payment-status-panel";
import { useWalletBack } from "../hooks/use-wallet-back";

export function PaymentStatusPreparationScreen() {
  const back = useWalletBack("status");
  return (
    <AppScreenLayout
      title="Trạng thái thanh toán"
      selected="Hồ sơ"
      back={{ href: "/wallet", label: "Quay lại", onPress: back }}
    >
      {() => (
        <KeyboardFormScrollView contentContainerStyle={ui.page}>
          <PaymentStatusPanel state={{ status: "unavailable", stale: false }} />
          <Copy>
            Nếu lần nạp trước chưa rõ kết quả, không tạo lại yêu cầu. Hiện chưa
            thể khôi phục hoặc đối chiếu yêu cầu sau khi kết thúc phiên.
          </Copy>
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
