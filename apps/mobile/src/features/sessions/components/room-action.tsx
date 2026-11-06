import { Pressable, View } from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import { roomColors, roomStyles as styles } from "./native-room.styles";

export function RoomAction({
  icon,
  label,
  onPress,
  disabled = false,
  tone,
  selected,
  count = 0,
}: Readonly<{
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "off" | "active" | "danger";
  selected?: boolean;
  count?: number;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label + (count ? ` (${count} tin nhắn)` : "")}
      accessibilityState={{
        disabled,
        ...(selected === undefined ? {} : { selected }),
      }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        tone === "off" && styles.off,
        tone === "active" && styles.active,
        tone === "danger" && styles.danger,
        (disabled || pressed) && { opacity: disabled ? 0.4 : 0.75 },
      ]}
    >
      <Icon
        name={icon}
        size={22}
        color={tone === "active" ? roomColors.activeInk : roomColors.text}
      />
      {count > 0 && <View style={styles.unreadDot} />}
    </Pressable>
  );
}
