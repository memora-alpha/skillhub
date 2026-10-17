import { Text } from "react-native";
import { fonts, appColors } from "@/constants/theme";
import { useWallet } from "../hooks/use-wallet";
import { formatCredit } from "../utils/amount";

export function HomeWalletBalance() {
  const { state } = useWallet();
  const amount = state.data && formatCredit(state.data.availableCredit);
  const caption = amount
    ? `${amount}${state.status === "refreshing" ? " · Đang cập nhật" : state.stale ? " · Chưa cập nhật được" : ""}`
    : state.status === "loading"
      ? "Đang tải số dư"
      : state.status === "denied"
        ? "Không có quyền xem số dư"
        : ["error", "not-found"].includes(state.status)
          ? "Chưa tải được số dư"
          : "Chưa sẵn sàng";
  return (
    <Text
      accessibilityLabel={
        amount
          ? `Số dư Credit: ${caption}`
          : state.status === "unavailable"
            ? "Số dư Credit chưa sẵn sàng"
            : caption
      }
      accessibilityLiveRegion="polite"
      style={{
        fontFamily: fonts.bold,
        fontSize: 14,
        lineHeight: 20,
        color: appColors.muted,
        flexShrink: 1,
      }}
    >
      {caption}
    </Text>
  );
}
