import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { iconSizes, typography, fonts } from "@/constants/theme";
import { messageColors as colors } from "../constants/theme";

export function ChatComposer({
  value,
  onChange,
  onSend,
  onAttach,
  pending = false,
  hasAttachment = false,
  sendDisabled = false,
  attachmentDisabled = false,
  attachmentPreview,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  onAttach: () => void;
  pending?: boolean;
  hasAttachment?: boolean;
  sendDisabled?: boolean;
  attachmentDisabled?: boolean;
  attachmentPreview?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const disabled = pending || sendDisabled || (!value.trim() && !hasAttachment);
  return (
    <View style={styles.composer}>
      <View style={styles.content}>
        {attachmentPreview}
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đính kèm tệp"
            onPress={onAttach}
            disabled={pending || attachmentDisabled}
            style={styles.attach}
          >
            <Icon
              name="paperclip"
              size={iconSizes.control}
              color={colors.muted}
            />
          </Pressable>
          <TextInput
            accessibilityLabel="Nhập tin nhắn"
            value={value}
            maxLength={2000}
            editable={!pending}
            onChangeText={onChange}
            placeholder="Nhập tin nhắn..."
            multiline
            placeholderTextColor={colors.mutedLight}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            returnKeyType="send"
            onSubmitEditing={(event) => {
              if (!disabled) onSend(event.nativeEvent.text);
            }}
            submitBehavior="newline"
            style={[styles.input, focused && { borderColor: colors.brand }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Gửi tin nhắn"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => onSend(value)}
            style={[styles.send, disabled && { opacity: 0.5 }]}
          >
            <Icon name="send" size={iconSizes.control} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  composer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: "100%",
    maxWidth: 768,
    alignSelf: "center",
  },
  content: { width: "100%", maxWidth: 768, alignSelf: "center", gap: 8 },
  attach: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.tag,
    borderRadius: 16,
    fontFamily: fonts.body,
    ...typography.body,
    color: colors.ink,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orange,
  },
});
