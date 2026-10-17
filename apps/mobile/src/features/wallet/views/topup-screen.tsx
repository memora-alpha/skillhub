import { useSyncExternalStore } from "react";
import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { ui } from "@/components/feature-page";
import { useOptionalWalletRuntime } from "../context/WalletProvider";
import { TopupForm } from "../components/topup-form";
import { useWalletBack } from "../hooks/use-wallet-back";
import { WalletUnavailableScreen } from "./unavailable-screen";
import type { PaymentPreparation } from "../utils/payment-intent";

export function TopupPreparationScreen() {
  const runtime = useOptionalWalletRuntime();
  if (!runtime?.isCurrent()) return <WalletUnavailableScreen view="topup" />;
  return <TopupContent model={runtime.preparation.model} />;
}
function TopupContent({ model }: { model: PaymentPreparation }) {
  const state = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const back = useWalletBack("topup", state.stage === "CREATING");
  return (
    <AppScreenLayout
      title="Nạp Credit"
      selected="Hồ sơ"
      back={{
        href: "/wallet",
        label: "Quay lại",
        onPress: () =>
          state.stage === "REVIEW" ? model.backToDraft() : back(),
      }}
    >
      {() => (
        <KeyboardFormScrollView contentContainerStyle={ui.page}>
          <TopupForm model={model} />
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
