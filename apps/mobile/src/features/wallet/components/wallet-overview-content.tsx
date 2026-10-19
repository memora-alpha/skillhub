import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import { Copy, Panel } from "./wallet-ui";
import { FinancialReadState } from "./financial-read-state";
import { WalletBalances } from "./wallet-balances";
import type { FinancialRead, WalletSnapshot } from "../types/wallet";

export function WalletOverviewContent({
  state,
  onRetry,
  onTopup,
  onHistory,
  refreshIndicator = "inline",
  topupLabel = "Nạp Credit",
  topupDisabled = false,
}: {
  state: FinancialRead<WalletSnapshot>;
  onRetry?: () => void;
  onTopup: () => void;
  onHistory: () => void;
  refreshIndicator?: "inline" | "pull";
  topupLabel?: string;
  topupDisabled?: boolean;
}) {
  return (
    <>
      <FinancialReadState
        state={state}
        onRetry={onRetry}
        refreshIndicator={refreshIndicator}
      >
        {state.data && <WalletBalances snapshot={state.data} />}
      </FinancialReadState>
      <Button
        variant="craft"
        size="lg"
        style={styles.primary}
        onPress={onTopup}
        disabled={topupDisabled}
        accessibilityLabel={topupLabel}
      >
        <Icon name="plus" color={colors.white} size={18} />
        <Text style={styles.primaryLabel}>{topupLabel}</Text>
      </Button>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Lịch sử giao dịch"
        onPress={onHistory}
        style={({ pressed }) => [styles.history, pressed && styles.pressed]}
      >
        <View style={styles.icon}>
          <Icon name="clock" color={colors.forest} size={22} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.title}>Lịch sử giao dịch</Text>
          <Text style={styles.caption}>Xem biến động Credit trong ví</Text>
        </View>
        <Icon name="chevron" color={colors.muted} size={18} />
      </Pressable>
      <Panel title="Credit đồng hành cùng bạn">
        <Copy muted>
          1.000 VND = 1 Credit. Credit được dùng cho các hoạt động trên
          SkillHub.
        </Copy>
        <Copy muted>
          Credit tạm giữ được dành cho các hoạt động đã xác nhận và chưa thể sử
          dụng.
        </Copy>
      </Panel>
    </>
  );
}
const styles = StyleSheet.create({
  primary: { minHeight: 48, borderRadius: appRadius.control },
  primaryLabel: {
    fontFamily: fonts.semibold,
    ...typography.body,
    color: colors.white,
    flexShrink: 1,
  },
  history: {
    padding: 16,
    borderRadius: appRadius.card,
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    minHeight: 64,
  },
  icon: {
    padding: 12,
    borderRadius: appRadius.full,
    backgroundColor: colors.forestSoft,
  },
  grow: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontFamily: fonts.bold, ...typography.body, color: colors.ink },
  caption: {
    fontFamily: fonts.body,
    ...typography.secondary,
    color: colors.body,
  },
  pressed: { opacity: 0.7 },
});
