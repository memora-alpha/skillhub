import { View } from "react-native";
import { useCallback, useRef } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { useRewards } from "../context/rewards-provider";
import { rewardFailure } from "../utils/reward-presentation";

export function RedemptionRecovery({
  showUnavailable = false,
}: Readonly<{ showUnavailable?: boolean }>) {
  const { state, model } = useRewards();
  const router = useRouter();
  const active = useRef(false);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => {
        active.current = false;
      };
    }, []),
  );
  if (state.stage === "ready" && state.notice === "not-redeemed")
    return (
      <FormNotice tone="info" compact>
        Credit chưa bị trừ. Bạn có thể kiểm tra giá và đổi lại.
      </FormNotice>
    );
  if (state.stage === "unavailable" && showUnavailable)
    return (
      <FormNotice tone="warning" compact>
        {rewardFailure(state.error)}
      </FormNotice>
    );
  if (state.stage !== "uncertain" && state.stage !== "pending") return null;
  return (
    <View style={{ gap: 8 }}>
      <FormNotice tone="warning" compact>
        {state.stage === "pending"
          ? "Đang xử lý yêu cầu đổi voucher…"
          : "Có yêu cầu đổi chưa rõ kết quả. Kiểm tra trước khi đổi tiếp."}
      </FormNotice>
      {state.stage === "uncertain" && !!state.error && (
        <FormNotice tone="error" compact>
          {rewardFailure(state.error)}
        </FormNotice>
      )}
      {state.stage === "uncertain" && (
        <Button
          variant="paper"
          onPress={() => {
            void model.recover().then((row) => {
              if (row && active.current)
                router.push(`/vouchers/mine/${row.id}`);
            });
          }}
        >
          Kiểm tra yêu cầu trước
        </Button>
      )}
    </View>
  );
}
