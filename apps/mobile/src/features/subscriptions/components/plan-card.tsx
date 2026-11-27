import { Platform, Pressable, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appColors } from "@/constants/theme";
import type {
  Interval,
  Plan,
  Subscription,
} from "../api/subscription-contracts";
import {
  creditLabel,
  planName,
  planPrice,
} from "../utils/subscription-presentation";
import { membershipStyles as s } from "./subscription.styles";

export function PlanCard({
  plan,
  interval,
  current,
  selected,
  onSelect,
  onNavigate,
}: Readonly<{
  plan: Plan;
  interval: Interval;
  current: Subscription | null;
  selected: boolean;
  onSelect: () => void;
  onNavigate: (direction: -1 | 1) => void;
}>) {
  const isCurrent = current?.planCode === plan.planCode;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${planName(plan.planCode)}, ${creditLabel(planPrice(plan, interval))}${isCurrent ? ", gói đang dùng" : ""}`}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      onPress={onSelect}
      onKeyDown={
        Platform.OS === "web"
          ? (event) => {
              const key = event.nativeEvent.key;
              if (key !== "ArrowLeft" && key !== "ArrowRight") return;
              event.preventDefault();
              const direction = key === "ArrowLeft" ? -1 : 1;
              onNavigate(direction);
              const target = event.currentTarget;
              if (target instanceof HTMLElement) {
                const choices = Array.from(
                  target
                    .closest('[role="radiogroup"]')
                    ?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [],
                );
                const next =
                  (choices.indexOf(target) + direction + choices.length) %
                  choices.length;
                choices[next]?.focus();
              }
            }
          : undefined
      }
      style={({ pressed }) => [
        s.planChoice,
        selected && s.planChoiceSelected,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={s.between}>
        <View style={[s.planIcon, selected && s.planIconSelected]}>
          <Icon
            name={plan.planCode === "PRO" ? "zap" : "book"}
            size={20}
            color={selected ? appColors.white : appColors.brand}
          />
        </View>
        <View style={[s.radio, selected && s.radioSelected]}>
          {selected && <Icon name="check" size={12} color={appColors.white} />}
        </View>
      </View>
      <View style={s.details}>
        <Text style={s.title}>{planName(plan.planCode)}</Text>
        <Text style={s.choicePrice}>
          {creditLabel(planPrice(plan, interval)).replace(/ Credit$/, "")}
        </Text>
        <Text style={s.muted}>
          Credit / {interval === "MONTH" ? "30" : "365"} ngày
        </Text>
      </View>
      {isCurrent && <Text style={[s.muted, s.accent]}>Gói đang dùng</Text>}
    </Pressable>
  );
}
