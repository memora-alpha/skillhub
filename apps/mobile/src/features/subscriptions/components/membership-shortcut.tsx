import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { appColors } from "@/constants/theme";
import { useMembership } from "../hooks/use-membership";
import { planName } from "../utils/subscription-presentation";
import { membershipStyles as s } from "./subscription.styles";

export function MembershipShortcut() {
  const router = useRouter();
  const query = useMembership();
  const current = query.data?.subscription;
  let detail = "Xem các gói và quyền lợi";
  if (query.isLoading) detail = "Đang tải gói của bạn…";
  else if (query.data && !query.error)
    detail = `${planName(current?.planCode)}${current?.status === "GRACE" ? " · Chờ gia hạn" : " · Xem quyền lợi"}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Gói thành viên. ${detail}`}
      onPress={() => router.push("/membership")}
      style={({ pressed }) => [s.shortcut, pressed && { opacity: 0.8 }]}
    >
      <View style={s.icon}>
        <Icon name="award" color={appColors.brand} size={22} />
      </View>
      <View style={s.grow}>
        <Text style={s.heading}>Gói thành viên</Text>
        <Text style={s.muted}>{detail}</Text>
      </View>
      <Icon name="chevron" color={appColors.brand} size={18} />
    </Pressable>
  );
}
