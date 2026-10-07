import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { iconSizes, typography, fonts } from "@/constants/theme";
import { chatCopy } from "../mocks/chat";
import { messageColors as colors } from "../constants/theme";

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
          <Icon name="paperclip" size={iconSizes.control} color={colors.muted} />
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
          <Icon name="send" size={iconSizes.control} color={colors.white} />
        </Pressable>
      </View>
      <Text style={styles.hint}>{chatCopy.footer}</Text>
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F5F4F2",
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
  hint: {
    fontFamily: fonts.body,
    ...typography.caption,
    textAlign: "center",
    color: colors.mutedLight,
  },
});
