import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appRadius, fonts, typography } from "@/constants/theme";
import { messageColors as colors } from "../constants/theme";

export function fileSizeLabel(bytes: number) {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.ceil(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function ChatFileCard({
  filename,
  bytes,
  mine = false,
  pending = false,
  disabled = false,
  onPress,
}: Readonly<{
  filename: string;
  bytes: number;
  mine?: boolean;
  pending?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}>) {
  const extension =
    /\.([a-z0-9]{1,10})$/i.exec(filename)?.[1]?.toUpperCase() ?? "TỆP";
  const image = /^(JPG|JPEG|PNG|WEBP)$/.test(extension);
  const content = (
    <>
      <View style={[styles.icon, mine && styles.myIcon]}>
        <Icon
          name={image ? "image" : "file"}
          size={22}
          color={mine ? colors.brand : colors.sage}
        />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={2} ellipsizeMode="middle" style={styles.name}>
          {filename}
        </Text>
        <Text style={styles.meta}>
          {pending ? "Đang mở tệp…" : `${extension} · ${fileSizeLabel(bytes)}`}
        </Text>
      </View>
      {!!onPress && <Icon name="download" size={18} color={colors.muted} />}
    </>
  );
  if (!onPress)
    return <View style={[styles.card, mine && styles.mine]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mở tệp ${filename}, ${fileSizeLabel(bytes)}`}
      accessibilityState={{ disabled: disabled || pending, busy: pending }}
      disabled={disabled || pending}
      onPress={() => {
        if (!disabled && !pending) onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        mine && styles.mine,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    minHeight: 72,
    minWidth: 0,
    borderRadius: appRadius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  mine: { backgroundColor: colors.orangePale },
  icon: {
    width: 40,
    height: 44,
    borderRadius: appRadius.control,
    backgroundColor: colors.sageLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  myIcon: { backgroundColor: colors.orangeSoft },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  name: { ...typography.body, fontFamily: fonts.semibold, color: colors.ink },
  meta: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.inkSoft,
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.65 },
});
