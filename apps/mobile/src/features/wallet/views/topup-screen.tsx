import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { Copy, Panel, RouteButton, ui } from "../components/wallet-ui";
import { PaymentCreatePanel } from "../components/payment-create-panel";
import { useOwnerPaymentCreate } from "../hooks/use-owner-payment-create";
import { useWalletBack } from "../hooks/use-wallet-back";
import { resumesPayment } from "../utils/payment-auto-read";

export function TopupPreparationScreen() {
  const { model, state, active, isActive } = useOwnerPaymentCreate(),
    router = useRouter();
  const back = useWalletBack("topup", state.busy && state.stage === "claiming");
  const routing = useRef(false);
  useEffect(() => {
    if (!model || !active || !isActive() || state.busy || routing.current)
      return;
    const current = model.getSnapshot();
    if (current.busy) return;
    if (current.canStartNext) {
      model.startNext();
      return;
    }
    if (resumesPayment(current)) {
      routing.current = true;
      router.replace("/wallet/payment");
    }
  }, [model, active, isActive, state, router]);
  return (
    <AppScreenLayout
      title="Nạp Credit"
      selected="Hồ sơ"
      back={{
        href: "/wallet",
        label: "Quay lại",
        onPress: () => (state.stage === "review" ? model?.back() : back()),
      }}
    >
      {() => (
        <KeyboardFormScrollView contentContainerStyle={ui.page}>
          {model ? (
            resumesPayment(state) || state.canStartNext ? (
              <Copy muted>Đang mở thanh toán…</Copy>
            ) : (
              <>
                <PaymentCreatePanel
                  model={model}
                  active={active}
                  mode="account"
                />
              </>
            )
          ) : (
            <Panel title="Nạp Credit trên ứng dụng">
              <Copy>
                Vui lòng dùng ứng dụng Android hoặc iOS để nạp Credit và khôi
                phục yêu cầu an toàn. Bản web vẫn hỗ trợ xem ví và lịch sử.
              </Copy>
              <RouteButton secondary href="/wallet">
                Về ví Credit
              </RouteButton>
            </Panel>
          )}
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}
