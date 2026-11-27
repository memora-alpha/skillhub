import {
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import { appColors } from "@/constants/theme";
import type {
  Interval,
  Plan,
  PlanCode,
  Subscription,
} from "../api/subscription-contracts";
import {
  intervalName,
  planName,
  storageLabel,
} from "../utils/subscription-presentation";
import { PlanCard } from "./plan-card";
import { membershipStyles as s } from "./subscription.styles";

export function PlanSelection({
  plans,
  selected,
  interval,
  current,
  onSelect,
  onInterval,
}: Readonly<{
  plans: Plan[];
  selected: Plan;
  interval: Interval;
  current: Subscription | null;
  onSelect: (code: PlanCode) => void;
  onInterval: (interval: Interval) => void;
}>) {
  const { fontScale } = useWindowDimensions();
  const benefits: { icon: IconName; value: string; label: string }[] = [
    {
      icon: "book",
      value: storageLabel(selected.entitlements.materialStorageBytes),
      label: "Lưu trữ tài liệu",
    },
    {
      icon: "video",
      value: `${selected.entitlements.recordingMinutesPerPeriod} phút`,
      label: "Ghi hình mỗi 30 ngày",
    },
    {
      icon: "clock",
      value: `${selected.entitlements.recordingRetentionDays} ngày`,
      label: "Lưu bản ghi",
    },
    {
      icon: "clipboard",
      value: `${selected.entitlements.whiteboardRetentionDays} ngày`,
      label: "Lưu bảng trắng",
    },
  ];
  return (
    <View style={s.stack}>
      <View style={s.sectionHeading}>
        <Text accessibilityRole="header" style={s.heading}>
          Chọn gói phù hợp
        </Text>
        <Text style={s.muted}>Thanh toán bằng Credit khả dụng</Text>
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Chu kỳ thanh toán"
        style={s.intervalTrack}
      >
        {(["MONTH", "YEAR"] as const).map((value, index) => (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ checked: interval === value }}
            aria-checked={interval === value}
            tabIndex={interval === value ? 0 : -1}
            accessibilityLabel={intervalName(value)}
            onPress={() => onInterval(value)}
            onKeyDown={
              Platform.OS === "web"
                ? (event) => {
                    if (
                      ["ArrowLeft", "ArrowRight"].includes(
                        event.nativeEvent.key,
                      )
                    ) {
                      event.preventDefault();
                      onInterval(index === 0 ? "YEAR" : "MONTH");
                      const target = event.currentTarget;
                      if (target instanceof HTMLElement)
                        target
                          .closest('[role="radiogroup"]')
                          ?.querySelectorAll<HTMLElement>('[role="radio"]')
                          [index === 0 ? 1 : 0]?.focus();
                    }
                  }
                : undefined
            }
            style={[s.intervalOption, interval === value && s.intervalSelected]}
          >
            <Text style={[s.intervalLabel, interval === value && s.accent]}>
              {intervalName(value)}
            </Text>
          </Pressable>
        ))}
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Chọn gói thành viên"
        style={[s.planChoices, fontScale > 1.3 && s.singleColumn]}
      >
        {plans.map((plan, index) => (
          <PlanCard
            key={plan.planCode}
            plan={plan}
            selected={selected.planCode === plan.planCode}
            interval={interval}
            current={current}
            onSelect={() => onSelect(plan.planCode)}
            onNavigate={(direction) =>
              onSelect(
                plans[(index + direction + plans.length) % plans.length]!
                  .planCode,
              )
            }
          />
        ))}
      </View>
      <View style={s.benefitsPanel}>
        <View style={s.between}>
          <Text accessibilityRole="header" style={s.heading}>
            Quyền lợi {planName(selected.planCode)}
          </Text>
          <View style={s.benefitMark}>
            <Icon name="check" color={appColors.brand} size={16} />
          </View>
        </View>
        <View style={s.benefitGrid}>
          {benefits.map((benefit) => (
            <View
              key={benefit.icon}
              style={[s.benefitCell, fontScale > 1.3 && s.fullCell]}
            >
              <Icon name={benefit.icon} color={appColors.brand} size={18} />
              <Text style={s.benefitValue}>{benefit.value}</Text>
              <Text style={s.muted}>{benefit.label}</Text>
            </View>
          ))}
        </View>
        {selected.entitlements.feeTier && (
          <View style={s.feeNote}>
            <Icon name="check-circle" color={appColors.brand} size={16} />
            <Text style={[s.muted, s.grow]}>
              Mức phí giảng dạy một chiều và bán tài liệu theo gói{" "}
              {planName(selected.entitlements.feeTier)}.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
