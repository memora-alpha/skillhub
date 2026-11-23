import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { AppError } from "@/lib/http/errors";
import type { RewardProduct } from "../api/reward-contracts";
import type { RedemptionState } from "../utils/redemption-coordinator";
import { creditLabel, rewardFailure } from "../utils/reward-presentation";
import { rewardStyles as s } from "./reward.styles";

export function VoucherRedeemFooter({
  product,
  state,
  disabled,
  recovery,
  onRedeem,
  onReload,
  onRecoverStorage,
}: Readonly<{
  product: RewardProduct;
  state: RedemptionState;
  disabled: boolean;
  recovery?: ReactNode;
  onRedeem: () => void;
  onReload: () => void;
  onRecoverStorage: () => void;
}>) {
  const error =
    state.stage === "ready" && state.intent?.productId === product.id
      ? state.error
      : undefined;
  const priceChanged =
    error instanceof AppError && error.code === "REWARD_PRICE_CHANGED";
  return (
    <View style={s.footer}>
      {!!error && (
        <View style={s.footerFeedback}>
          <FormNotice tone="error" compact>
            {rewardFailure(error)}
          </FormNotice>
          {priceChanged && (
            <Button variant="paper" onPress={onReload}>
              Tải lại giá voucher
            </Button>
          )}
        </View>
      )}
      {recovery}
      {state.stage === "unavailable" && (
        <Button variant="paper" onPress={onRecoverStorage}>
          Thử lại
        </Button>
      )}
      <View style={s.total}>
        <Text style={[s.body, s.grow]}>Credit cần đổi</Text>
        <Text style={[s.price, s.footerPrice]}>
          {creditLabel(product.priceCredit)}
        </Text>
      </View>
      <Button
        variant="craft"
        disabled={disabled}
        leadingIcon="ticket"
        onPress={onRedeem}
      >
        {state.stage === "pending" ? "Đang đổi voucher…" : "Đổi voucher"}
      </Button>
    </View>
  );
}
