import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { Panel, Copy, RouteButton, ui } from "@/components/feature-page";
import { FinancialReadState } from "../components/financial-read-state";
import { useWalletBack } from "../hooks/use-wallet-back";
import { walletFallback, type WalletView } from "../utils/navigation";

const titles = {
  wallet: "Ví Credit",
  topup: "Nạp Credit",
  payment: "Thanh toán",
  status: "Trạng thái thanh toán",
  history: "Lịch sử giao dịch",
  transaction: "Chi tiết giao dịch",
} as const;
export function WalletUnavailableScreen({ view }: { view: WalletView }) {
  const onBack = useWalletBack(view);
  return (
    <AppScreenLayout
      title={titles[view]}
      selected="Hồ sơ"
      back={{ href: walletFallback(view), label: "Quay lại", onPress: onBack }}
    >
      {() => (
        <KeyboardFormScrollView contentContainerStyle={ui.page}>
          <Panel title={titles[view]}>
            <FinancialReadState
              state={{ status: "unavailable", stale: false }}
              unavailableMessage={
                view === "wallet"
                  ? "Số dư khả dụng và đang tạm giữ chưa sẵn sàng. Bạn có thể quay lại kiểm tra sau."
                  : "Tính năng này hiện chưa sẵn sàng. Bạn có thể quay lại ví."
              }
            />
            {view === "wallet" ? (
              <>
                <RouteButton href="/wallet/topup">Nạp Credit</RouteButton>
                <RouteButton secondary href="/wallet/history">
                  Lịch sử giao dịch
                </RouteButton>
              </>
            ) : (
              <RouteButton secondary href="/wallet">
                Về ví Credit
              </RouteButton>
            )}
          </Panel>
          {view === "status" && (
            <Copy muted>
              Chưa thể xác nhận kết quả thanh toán. Thông tin từ liên kết không
              xác nhận giao dịch.
            </Copy>
          )}
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
