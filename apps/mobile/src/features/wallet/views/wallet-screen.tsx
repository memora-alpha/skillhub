import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { ui } from "../components/wallet-ui";
import { useWallet } from "../hooks/use-wallet";
import { useWalletBack } from "../hooks/use-wallet-back";
import { WalletOverviewContent } from "../components/wallet-overview-content";

export function WalletOverview() {
  const { state, refresh } = useWallet();
  const onBack = useWalletBack("wallet");
  const router = useRouter();
  return (
    <AppScreenLayout
      title="Ví Credit"
      selected="Hồ sơ"
      back={{ href: "/profile", label: "Quay lại", onPress: onBack }}
    >
      {() => (
        <KeyboardFormScrollView
          contentContainerStyle={ui.page}
          refreshControl={
            <RefreshControl
              refreshing={state.status === "refreshing"}
              onRefresh={() => void refresh()}
            />
          }
        >
          <WalletOverviewContent
            refreshIndicator="pull"
            state={state}
            onRetry={() => void refresh()}
            onTopup={() => router.push("/wallet/topup")}
            onHistory={() => router.push("/wallet/history")}
          />
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
