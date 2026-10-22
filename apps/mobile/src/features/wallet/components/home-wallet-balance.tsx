import { Text } from "react-native";
import { fonts, appColors, typography } from "@/constants/theme";
import { useWallet } from "../hooks/use-wallet";
import { formatCredit } from "../utils/amount";
import type { FinancialRead, WalletSnapshot } from "../types/wallet";

function balanceCaption(state: FinancialRead<WalletSnapshot>, amount?: string) {
  if (amount) {
    if (state.status === "refreshing") return `${amount} · Đang cập nhật`;
    if (state.stale) return `${amount} · Chưa cập nhật được`;
    return amount;
  }
  switch (state.status) {
    case "loading":
      return "Đang tải số dư";
    case "denied":
      return "Không có quyền xem số dư";
    case "error":
    case "not-found":
      return "Chưa tải được số dư";
    default:
      return "Chưa sẵn sàng";
  }
}

export function HomeWalletBalance() {
  const { state } = useWallet();
  const amount = state.data && formatCredit(state.data.availableCredit);
  const caption = balanceCaption(state, amount);
  let accessibilityLabel = caption;
  if (amount) accessibilityLabel = `Số dư Credit: ${caption}`;
  else if (state.status === "unavailable")
    accessibilityLabel = "Số dư Credit chưa sẵn sàng";
  return (
    <Text
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      style={{
        fontFamily: fonts.bold,
        ...typography.secondary,
        color: appColors.muted,
        flexShrink: 1,
      }}
    >
      {caption}
    </Text>
  );
}
