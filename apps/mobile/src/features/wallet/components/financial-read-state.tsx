import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { Copy, ui } from "@/components/feature-page";
import { colors } from "@/constants/theme";
import type { FinancialRead } from "../types/wallet";

const labels = {
  unavailable: "Thông tin chưa sẵn sàng",
  loading: "Đang tải thông tin",
  empty: "Chưa có giao dịch phù hợp",
  refreshing: "Đang cập nhật thông tin",
  "refresh-error":
    "Chưa cập nhật được thông tin. Đang hiển thị dữ liệu trước đó.",
  error: "Chưa thể tải thông tin. Vui lòng thử lại.",
  denied: "Bạn không có quyền xem thông tin này.",
  "not-found": "Không tìm thấy thông tin.",
  "session-ended": "Vui lòng đăng nhập để xem thông tin.",
  ready: "",
} as const;
export function FinancialReadState({
  state,
  onRetry,
  children,
  unavailableMessage,
}: {
  state: FinancialRead<unknown>;
  onRetry?: () => void;
  children?: ReactNode;
  unavailableMessage?: string;
}) {
  const busy = state.status === "loading" || state.status === "refreshing";
  const retained =
    ["ready", "refreshing", "refresh-error"].includes(state.status) &&
    state.data !== undefined;
  const retry = onRetry && ["error", "refresh-error"].includes(state.status);
  return (
    <View style={{ gap: 12 }}>
      {retained && children}
      {state.status !== "ready" && (
        <View accessibilityState={{ busy }} style={{ gap: 10 }}>
          {busy && (
            <ActivityIndicator
              color={colors.brand}
              accessibilityLabel={labels[state.status]}
            />
          )}
          <Text
            accessibilityLiveRegion={busy ? "none" : "polite"}
            style={ui.copy}
          >
            {labels[state.status]}
          </Text>
          {state.status === "unavailable" && (
            <Copy muted>
              {unavailableMessage ?? "Bạn có thể quay lại kiểm tra sau."}
            </Copy>
          )}
          {retry && (
            <Button variant="paper" onPress={onRetry}>
              Thử lại
            </Button>
          )}
        </View>
      )}
    </View>
  );
}
