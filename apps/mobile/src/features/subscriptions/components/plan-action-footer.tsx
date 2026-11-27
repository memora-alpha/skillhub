import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import type {
  Interval,
  Plan,
  Subscription,
} from "../api/subscription-contracts";
import {
  creditLabel,
  intervalName,
  planAction,
  planName,
  planPrice,
} from "../utils/subscription-presentation";
import { membershipStyles as s } from "./subscription.styles";

export function PlanActionFooter({
  plan,
  interval,
  current,
  disabled,
  busy,
  onSelect,
}: Readonly<{
  plan: Plan;
  interval: Interval;
  current: Subscription | null;
  disabled: boolean;
  busy: boolean;
  onSelect: () => void;
}>) {
  const action = planAction(plan, interval, current);
  const labels = {
    purchase: `Đăng ký ${planName(plan.planCode)}`,
    upgrade: "Nâng cấp lên Pro",
    schedule: "Hẹn đổi từ kỳ tới",
    current: "Đang sử dụng gói này",
    unavailable: "Chưa thể nâng cấp",
  };
  return (
    <View style={s.actionFooter}>
      <View style={s.actionFooterContent}>
        <View style={s.between}>
          <Text style={s.heading}>{planName(plan.planCode)}</Text>
          <Text style={[s.heading, s.footerPrice]}>
            {creditLabel(planPrice(plan, interval))}
          </Text>
        </View>
        <Text style={s.muted}>
          {action === "schedule"
            ? "Giá tham khảo; giá gia hạn được xác định ở kỳ tiếp theo."
            : `Chu kỳ ${intervalName(interval)}`}
        </Text>
        {action === "unavailable" && (
          <Text style={s.muted}>
            Nâng cấp cần gói đang hoạt động và giữ chu kỳ hiện tại.
          </Text>
        )}
        <Button
          variant="craft"
          disabled={
            disabled || action === "current" || action === "unavailable"
          }
          onPress={onSelect}
        >
          {busy ? "Đang xử lý…" : labels[action]}
        </Button>
      </View>
    </View>
  );
}
