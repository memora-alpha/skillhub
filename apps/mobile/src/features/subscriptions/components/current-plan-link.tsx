import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appColors } from "@/constants/theme";
import type { Membership } from "../api/subscription-contracts";
import { dateLabel, planName } from "../utils/subscription-presentation";
import { membershipStyles as s } from "./subscription.styles";

export function CurrentPlanLink({
  membership,
  onManage,
}: Readonly<{ membership: Membership; onManage: () => void }>) {
  const current = membership.subscription;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Gói hiện tại ${planName(current?.planCode)}. Quản lý gói và mức sử dụng`}
      onPress={onManage}
      style={({ pressed }) => [s.currentLink, pressed && { opacity: 0.8 }]}
    >
      <View style={s.currentIcon}>
        <Icon name="award" color={appColors.brand} size={22} />
      </View>
      <View style={s.grow}>
        <Text style={s.muted}>Gói hiện tại</Text>
        <Text style={s.heading}>{planName(current?.planCode)}</Text>
        {current && (
          <Text style={s.muted}>
            {current.status === "GRACE"
              ? "Chờ gia hạn"
              : `Đến ${dateLabel(current.termEnd)}`}
          </Text>
        )}
      </View>
      <Text style={[s.linkLabel, s.accent]}>Quản lý</Text>
      <Icon name="chevron" color={appColors.brand} size={16} />
    </Pressable>
  );
}
