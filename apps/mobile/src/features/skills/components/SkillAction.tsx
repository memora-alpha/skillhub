import { Pressable, Text } from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import { appColors, fonts, typography } from "@/constants/theme";

export function SkillAction({
  label,
  icon,
  onPress,
  disabled = false,
  outlined = false,
}: Readonly<{
  label: string;
  icon?: IconName;
  onPress: () => void;
  disabled?: boolean;
  outlined?: boolean;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: outlined ? 8 : 6,
        paddingHorizontal: outlined ? 12 : 0,
        borderRadius: 12,
        borderWidth: outlined ? 1 : 0,
        borderColor: appColors.border,
        backgroundColor: outlined ? appColors.surface : "transparent",
        opacity: pressed || disabled ? 0.55 : 1,
      })}
    >
      {icon && <Icon name={icon} size={16} color={appColors.primary} />}
      <Text
        style={{
          fontFamily: fonts.semibold,
          ...typography.secondary,
          color: appColors.primary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
