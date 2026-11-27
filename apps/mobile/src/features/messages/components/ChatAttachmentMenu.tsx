import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { fonts, typography } from "@/constants/theme";
import { messageColors as colors } from "../constants/theme";
import type { ChatAttachmentSource } from "../utils/pick-chat-attachment";

export type ChatAttachmentMenuProps = Readonly<{
  disabled?: boolean;
  onSelect: (source: ChatAttachmentSource) => void;
}>;

// The native menu's web implementation has no actions. Keep a keyboard-accessible web chooser.
export function ChatAttachmentMenu({
  disabled = false,
  onSelect,
}: ChatAttachmentMenuProps) {
  const [open, setOpen] = useState(false);
  const select = (source: ChatAttachmentSource) => {
    setOpen(false);
    if (!disabled) onSelect(source);
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Thêm ảnh hoặc tệp"
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => {
          if (!disabled) setOpen(true);
        }}
        style={[styles.trigger, disabled && styles.disabled]}
      >
        <Icon name="plus" size={24} color={colors.brand} />
      </Pressable>
      <Modal
        visible={open && !disabled}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng menu đính kèm"
            onPress={() => setOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            role="dialog"
            aria-modal
            accessibilityViewIsModal
            accessibilityLabel="Chọn ảnh hoặc tệp"
            style={styles.menu}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn ảnh"
              onPress={() => select("photos")}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="image" size={22} color={colors.brand} />
              <Text style={styles.label}>Ảnh</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn tệp"
              onPress={() => select("files")}
              style={({ pressed }) => [
                styles.option,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="file" size={22} color={colors.brand} />
              <Text style={styles.label}>Tệp</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
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
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 12,
    paddingBottom: 76,
    backgroundColor: "rgba(28, 20, 16, 0.18)",
  },
  menu: {
    width: 200,
    maxWidth: "100%",
    padding: 6,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  option: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 12,
    borderRadius: 10,
  },
  label: { ...typography.body, fontFamily: fonts.semibold, color: colors.ink },
  pressed: { backgroundColor: colors.orangePale },
});
