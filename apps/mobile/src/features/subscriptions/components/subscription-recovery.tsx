import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { useConnections } from "@/features/connections";
import { useToast } from "@/providers/ToastProvider";
import { AppError } from "@/lib/http/errors";
import { SubscriptionFeedback } from "./subscription-feedback";
import { useSubscriptions } from "../context/subscriptions-provider";
import {
  creditLabel,
  planName,
  subscriptionFailure,
} from "../utils/subscription-presentation";
import { membershipStyles as s } from "./subscription.styles";

export function SubscriptionRecovery({
  recoveryOnly = false,
}: Readonly<{ recoveryOnly?: boolean }>) {
  const { model, state } = useSubscriptions();
  const runtime = useConnections();
  const { showToast } = useToast();
  const active = useRef(false);
  const focusGeneration = useRef(0);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      focusGeneration.current++;
      return () => {
        active.current = false;
      };
    }, []),
  );
  const resume = async () => {
    const initiatedFocus = focusGeneration.current;
    await model.resume();
    if (
      !active.current ||
      !runtime.isCurrent() ||
      focusGeneration.current !== initiatedFocus
    )
      return;
    const result = model.getSnapshot();
    if (result.error) showToast(subscriptionFailure(result.error), "error");
    else if (result.completed)
      showToast("Gói thành viên đã được cập nhật.", "success");
  };
  if (recoveryOnly && state.stage !== "pending" && state.stage !== "uncertain")
    return null;
  if (state.stage === "loading")
    return <Text style={s.muted}>Đang kiểm tra yêu cầu trên thiết bị…</Text>;
  if (state.stage === "unavailable")
    return (
      <View style={s.stack}>
        <SubscriptionFeedback>
          {subscriptionFailure(state.error)}
        </SubscriptionFeedback>
        {!(
          state.error instanceof AppError &&
          state.error.code === "SUBSCRIPTION_NATIVE_REQUIRED"
        ) && (
          <Button
            variant="ghost"
            onPress={() => {
              void model.load();
            }}
          >
            Kiểm tra lại thiết bị
          </Button>
        )}
      </View>
    );
  if (state.stage === "pending")
    return (
      <SubscriptionFeedback tone="info">
        Đang xử lý yêu cầu. Vui lòng chờ kết quả.
      </SubscriptionFeedback>
    );
  if (state.stage === "uncertain" && state.intent)
    return (
      <View style={s.card}>
        <Text style={s.heading}>Yêu cầu cần tiếp tục</Text>
        <Text style={s.body}>
          {planName(state.intent.command.body.planCode)} ·{" "}
          {creditLabel(state.intent.command.amount)}
        </Text>
        <Text style={s.muted}>
          Chưa xác nhận được kết quả trước. Tiếp tục sẽ gửi lại đúng yêu cầu cũ;
          nếu đã thành công, hệ thống không thu thêm Credit. Nếu chưa thực hiện,
          yêu cầu có thể được thanh toán.
        </Text>
        {!!state.error && (
          <SubscriptionFeedback>
            {subscriptionFailure(state.error)}
          </SubscriptionFeedback>
        )}
        <Button
          variant="craft"
          onPress={() => {
            void resume();
          }}
        >
          Tiếp tục yêu cầu đã xác nhận
        </Button>
      </View>
    );
  return null;
}
