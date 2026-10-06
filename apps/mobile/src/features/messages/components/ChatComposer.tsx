import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { colors, fonts } from "@/constants/theme";
import { chatCopy } from "../mocks/chat";

export function ChatComposer({
  value,
  onChange,
  onSend,
  onAttach,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  onAttach: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const disabled = !value.trim();
  return (
    <View style={styles.composer}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đính kèm tệp"
          onPress={onAttach}
          style={styles.attach}
        >
          <Icon name="paperclip" size={18} color={colors.muted} />
        </Pressable>
        <TextInput
          accessibilityLabel="Nhập tin nhắn"
          value={value}
          onChangeText={onChange}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor={colors.mutedLight}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          returnKeyType="send"
          onSubmitEditing={(event) => onSend(event.nativeEvent.text)}
          submitBehavior="submit"
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
          <Icon name="send" size={16} color={colors.white} />
        </Pressable>
      </View>
      <Text style={styles.hint}>{chatCopy.footer}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  composer: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
    maxWidth: 768,
    alignSelf: "center",
  },
  attach: { paddingHorizontal: 12, paddingVertical: 6 },
  input: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
  },
  send: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.brand,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    color: colors.mutedLight,
  },
});
