import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { useRouter } from "expo-router";
import { ui } from "../components/wallet-ui";
import { useWallet } from "../hooks/use-wallet";
import { useWalletBack } from "../hooks/use-wallet-back";
import { WalletOverviewContent } from "../components/wallet-overview-content";
import { useOwnerPaymentCreate } from "../hooks/use-owner-payment-create";
import { resumesPayment } from "../utils/payment-auto-read";

export function WalletOverview() {
  const { state, refresh } = useWallet();
  const onBack = useWalletBack("wallet");
  const router = useRouter();
  const payment = useOwnerPaymentCreate();
  return (
    <AppScreenLayout
      title="Ví Credit"
      selected="Hồ sơ"
      back={{ href: "/profile", label: "Quay lại", onPress: onBack }}
    >
      {() => (
        <KeyboardFormScrollView
          contentContainerStyle={ui.page}
          refreshing={state.status === "refreshing"}
          onRefresh={() => void refresh()}
        >
          <WalletOverviewContent
            refreshIndicator="pull"
            state={state}
            onRetry={() => void refresh()}
            topupLabel={
              resumesPayment(payment.state)
                ? "Tiếp tục thanh toán"
                : "Nạp Credit"
            }
            topupDisabled={!!payment.model && payment.state.stage === "loading"}
            onTopup={() => {
              const current = payment.model?.getSnapshot();
              if (current?.canStartNext) payment.model?.startNext();
              router.push(
                current && resumesPayment(current)
                  ? "/wallet/payment"
                  : "/wallet/topup",
              );
            }}
            onHistory={() => router.push("/wallet/history")}
          />
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
