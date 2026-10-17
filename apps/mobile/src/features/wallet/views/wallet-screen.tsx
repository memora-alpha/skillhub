import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { Button } from "@/components/Button";
import { Copy, Panel, RouteButton, ui } from "@/components/feature-page";
import { useWallet } from "../hooks/use-wallet";
import { useWalletBack } from "../hooks/use-wallet-back";
import { FinancialReadState } from "../components/financial-read-state";
import { WalletBalances } from "../components/wallet-balances";

export function WalletOverview() {
  const { state, refresh } = useWallet();
  const onBack = useWalletBack("wallet");
  return (
    <AppScreenLayout
      title="Ví Credit"
      selected="Hồ sơ"
      back={{ href: "/profile", label: "Quay lại", onPress: onBack }}
    >
      {() => (
        <KeyboardFormScrollView contentContainerStyle={ui.page}>
          <Panel title="Số dư Credit">
            <FinancialReadState state={state} onRetry={() => void refresh()}>
              {state.data && <WalletBalances snapshot={state.data} />}
            </FinancialReadState>
            {state.status === "ready" && (
              <Button variant="paper" onPress={() => void refresh()}>
                Cập nhật số dư
              </Button>
            )}
            {state.status === "refreshing" && (
              <Copy muted>Đang hiển thị số dư trước đó.</Copy>
            )}
          </Panel>
          <Panel title="Ví của bạn">
            <RouteButton href="/wallet/topup">Nạp Credit</RouteButton>
            <RouteButton secondary href="/wallet/history">
              Lịch sử giao dịch
            </RouteButton>
          </Panel>
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
