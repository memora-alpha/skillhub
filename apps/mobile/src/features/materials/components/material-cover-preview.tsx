import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Icon } from "@/components/Icon";
import { appColors, appRadius, fonts, typography } from "@/constants/theme";

export function MaterialCoverPreview({
  uri,
  expiresAt,
  disabled,
  onRemove,
}: Readonly<{
  uri?: string;
  expiresAt?: string;
  disabled: boolean;
  onRemove: () => void;
}>) {
  const [failed, setFailed] = useState<string>();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!expiresAt) return;
    const delay = Date.parse(expiresAt) - Date.now();
    if (delay <= 0) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(delay, 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [expiresAt]);
  const visible =
    uri &&
    uri !== failed &&
    (!expiresAt || Date.parse(expiresAt) > Math.max(now, Date.now()));
  return (
    <View style={styles.frame}>
      {visible ? (
        <Image
          source={{ uri }}
          style={styles.image}
          contentFit="contain"
          cachePolicy="none"
          recyclingKey={uri}
          accessibilityLabel="Ảnh bìa tài liệu"
          onError={() => setFailed(uri)}
        />
      ) : (
        <View style={styles.placeholder}>
          <Icon name="image" size={32} color={appColors.muted} />
          <Text style={styles.caption}>Ảnh bìa</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Gỡ ảnh bìa"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onRemove}
        style={({ pressed }) => [
          styles.remove,
          (pressed || disabled) && styles.dimmed,
        ]}
      >
        <Icon name="close" size={20} color={appColors.ink} />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  frame: {
    width: "100%",
    aspectRatio: 1.6,
    borderRadius: appRadius.control,
    overflow: "hidden",
    backgroundColor: appColors.surfaceLow,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  image: { width: "100%", height: "100%" },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  caption: {
    fontFamily: fonts.body,
    ...typography.caption,
    color: appColors.muted,
  },
  remove: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: appRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  dimmed: { opacity: 0.5 },
});
