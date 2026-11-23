import { useState } from "react";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appColors } from "@/constants/theme";
import type { Redemption, RewardProduct } from "../api/reward-contracts";
import {
  creditLabel,
  redemptionLabel,
  safeVoucherLink,
  vndLabel,
} from "../utils/reward-presentation";
import { rewardStyles as s } from "./reward.styles";

export function RewardLogo({
  name,
  uri,
}: Readonly<{ name: string; uri: string | null }>) {
  const [failed, setFailed] = useState(false);
  const url = safeVoucherLink(uri);
  return url && !failed ? (
    <Image
      source={{ uri: url }}
      style={s.logo}
      contentFit="contain"
      accessibilityLabel={`Logo ${name}`}
      onError={() => setFailed(true)}
    />
  ) : (
    <View style={[s.logo, s.logoFallback]}>
      <Text style={s.logoText}>{name.slice(0, 2).toLocaleUpperCase("vi")}</Text>
    </View>
  );
}
export function RewardCard({
  product,
  onPress,
  halfWidth = false,
}: Readonly<{
  product: RewardProduct;
  onPress: () => void;
  halfWidth?: boolean;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${vndLabel(product.faceValueVnd)}, đổi với ${creditLabel(product.priceCredit)}`}
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        halfWidth && s.halfCard,
        pressed && s.pressed,
      ]}
    >
      <View style={s.artwork}>
        <View style={s.artworkTop}>
          <RewardLogo name={product.brand.name} uri={product.brand.logoUrl} />
          <Icon name="ticket" color={appColors.primary} size={22} />
        </View>
        <Text style={s.amount}>{vndLabel(product.faceValueVnd)}</Text>
      </View>
      <View style={s.cardBody}>
        <Text style={s.brand}>{product.brand.name}</Text>
        <Text style={s.cardTitle}>{product.name}</Text>
        <Text style={s.price}>{creditLabel(product.priceCredit)}</Text>
      </View>
    </Pressable>
  );
}
export function RedemptionCard({
  redemption: row,
  onPress,
}: Readonly<{ redemption: Redemption; onPress: () => void }>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.product.name}, ${redemptionLabel(row)}`}
      onPress={onPress}
      style={({ pressed }) => [s.receipt, pressed && s.pressed]}
    >
      <RewardLogo name={row.product.brandName} uri={row.product.brandLogoUrl} />
      <View style={s.grow}>
        <Text style={s.brand}>{row.product.brandName}</Text>
        <Text style={s.cardTitle}>{row.product.name}</Text>
        <Text style={s.muted}>
          {redemptionLabel(row)} · {creditLabel(row.priceCredit)}
        </Text>
      </View>
      <Icon name="chevron" color={appColors.muted} />
    </Pressable>
  );
}
