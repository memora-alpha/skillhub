import { StyleSheet, View } from "react-native";
import { MenuView } from "@expo/ui/community/menu";
import { Icon } from "@/components/Icon";
import { messageColors as colors } from "../constants/theme";
import type { ChatAttachmentMenuProps } from "./ChatAttachmentMenu";

export function ChatAttachmentMenu({
  disabled = false,
  onSelect,
}: ChatAttachmentMenuProps) {
  const trigger = (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel="Thêm ảnh hoặc tệp"
      accessibilityState={{ disabled }}
      style={[styles.trigger, disabled && styles.disabled]}
    >
      <Icon name="plus" size={24} color={colors.brand} />
    </View>
  );
  if (disabled) return trigger;
  return (
    <MenuView
      actions={[
        { id: "photos", title: "Ảnh", image: "photo" },
        { id: "files", title: "Tệp", image: "doc" },
      ]}
      shouldOpenOnLongPress={false}
      onPressAction={({ nativeEvent }) => {
        if (
          !disabled &&
          (nativeEvent.event === "photos" || nativeEvent.event === "files")
        )
          onSelect(nativeEvent.event);
      }}
      style={styles.trigger}
    >
      {trigger}
    </MenuView>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.orangeSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.4 },
});
