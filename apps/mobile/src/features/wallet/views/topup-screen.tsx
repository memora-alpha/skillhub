import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { AppScreenLayout } from "@/features/shell";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { appRadius } from "@/constants/theme";
import { Copy, Panel, RouteButton, ui } from "../components/wallet-ui";
import { PaymentCreatePanel } from "../components/payment-create-panel";
import { TopupActionBar } from "../components/topup-action-bar";
import { useOwnerPaymentCreate } from "../hooks/use-owner-payment-create";
import { useWalletBack } from "../hooks/use-wallet-back";
import { resumesPayment } from "../utils/payment-auto-read";
import { paymentPalette as topupPalette } from "../components/wallet-payment-palette";

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
      title="Nạp Credit vào ví"
      centeredTitle
      contentStyle={{ backgroundColor: topupPalette.background }}
      selected="Hồ sơ"
      rightAction={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lịch sử nạp tiền"
          onPress={() => router.push("/wallet/history")}
          style={({ pressed }) => [styles.history, pressed && styles.pressed]}
          hitSlop={6}
        >
          <Icon name="clock" color={topupPalette.body} size={19} />
        </Pressable>
      }
      back={{
        href: "/wallet",
        label: "Quay lại",
        onPress: () => (state.stage === "review" ? model?.back() : back()),
      }}
    >
      {() => (
        <View style={styles.container}>
          <KeyboardFormScrollView
            style={styles.scroll}
            contentContainerStyle={[ui.page, styles.content]}
          >
            {model ? (
              resumesPayment(state) || state.canStartNext ? (
                <Copy muted>Đang mở thanh toán…</Copy>
              ) : (
                <PaymentCreatePanel
                  model={model}
                  active={active}
                  mode="account"
                  stickyAction
                />
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
          {model && (state.stage === "draft" || state.stage === "review") && (
            <TopupActionBar model={model} state={state} active={active} />
          )}
        </View>
      )}
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  scroll: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 16,
  },
  history: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appRadius.full,
    backgroundColor: topupPalette.surface,
    borderWidth: 1,
    borderColor: topupPalette.border,
  },
  pressed: { opacity: 0.7 },
});
