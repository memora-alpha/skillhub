import { useEffect, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  appColors as colors,
  appRadius,
  avatarSizes,
  fonts,
} from "@/constants/theme";
import { getAvatarColors } from "@/constants/avatar";

export function Avatar({
  name,
  userId,
  size = avatarSizes.list,
  ring = false,
  shape = "circle",
  style,
  textStyle,
  sourceUri,
  onImageError,
}: {
  name: string;
  userId?: string;
  size?: number;
  ring?: boolean;
  shape?: "square" | "circle";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  sourceUri?: string | null;
  onImageError?: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [sourceUri]);
  const tint = getAvatarColors(
    userId ?? name.normalize("NFC").trim().toLowerCase(),
  );
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  const initialSize = Math.max(9, Math.min(24, Math.round(size * 0.35)));
  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: shape === "circle" ? size / 2 : appRadius.control,
          backgroundColor: tint.background,
        },
        ring && styles.ring,
        style,
      ]}
    >
      {sourceUri && !imageFailed ? (
        <Image
          source={{ uri: sourceUri }}
          onError={() => {
            setImageFailed(true);
            onImageError?.();
          }}
          style={styles.image}
        />
      ) : (
        <Text
          numberOfLines={1}
          style={[
            styles.initials,
            {
              fontSize: initialSize,
              lineHeight: Math.ceil(initialSize * 1.2),
              color: tint.foreground,
            },
            textStyle,
          ]}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  circle: {
    flexShrink: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    borderWidth: 3,
    borderColor: colors.primary,
  },
  initials: {
    fontFamily: fonts.bold,
    textAlign: "center",
    includeFontPadding: false,
  },
  image: { width: "100%", height: "100%" },
});
