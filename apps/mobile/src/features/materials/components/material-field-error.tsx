import { Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appColors, fonts, typography } from "@/constants/theme";

export function MaterialFieldError({
  message,
}: Readonly<{ message?: string }>) {
  if (!message) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}
    >
      <Icon name="alert" size={14} color={appColors.error} />
      <Text
        style={{
          flex: 1,
          color: appColors.error,
          fontFamily: fonts.body,
          ...typography.secondary,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
