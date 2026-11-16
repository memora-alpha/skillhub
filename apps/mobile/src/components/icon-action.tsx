import { StyleSheet } from "react-native";
import { Button } from "./Button";
import type { IconName } from "./Icon";

export function IconAction({
  icon,
  label,
  onPress,
  disabled = false,
  expanded,
}: Readonly<{
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  expanded?: boolean;
}>) {
  return (
    <Button
      variant="ghost"
      size="sm"
      style={styles.button}
      leadingIcon={icon}
      accessibilityLabel={label}
      accessibilityState={{ expanded }}
      disabled={disabled}
      onPress={onPress}
    >
      {null}
    </Button>
  );
}
const styles = StyleSheet.create({
  button: { width: 44, minHeight: 44, paddingHorizontal: 0, flexShrink: 0 },
});
