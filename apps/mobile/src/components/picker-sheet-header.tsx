import { Pressable, Text, View } from "react-native";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { appColors, fonts, typography } from "@/constants/theme";

export function PickerSheetHeader({
  title,
  onClose,
  closeLabel = "Xong",
  closeIcon = false,
}: Readonly<{
  title: string;
  onClose: () => void;
  closeLabel?: string;
  closeIcon?: boolean;
}>) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          flex: 1,
          fontFamily: fonts.bold,
          ...typography.heading,
          color: appColors.ink,
        }}
      >
        {title}
      </Text>
      {closeIcon ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon name="close" size={22} color={appColors.body} />
        </Pressable>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          style={{ minHeight: 44 }}
          onPress={onClose}
        >
          {closeLabel}
        </Button>
      )}
    </View>
  );
}
