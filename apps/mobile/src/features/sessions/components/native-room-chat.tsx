import { useRef, useState, type ComponentRef } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/Avatar";
import { fonts } from "@/constants/theme";
import { roomChatTextLimit } from "../utils/ephemeral-chat";
import type { useRoomChat } from "../hooks/use-room-chat";

export function NativeRoomChat({
  chat,
  partnerName,
  partnerAvatarUrl,
  hidden = false,
}: Readonly<{
  chat: ReturnType<typeof useRoomChat>;
  partnerName: string;
  partnerAvatarUrl?: string | null;
  hidden?: boolean;
}>) {
  const [draft, setDraft] = useState("");
  const log = useRef<ComponentRef<typeof ScrollView>>(null);
  return (
    <View
      style={[styles.box, hidden && { display: "none" }]}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
    >
      <Text accessibilityRole="header" style={styles.heading}>
        Chat trong phiên học
      </Text>
      <Text style={styles.notice}>
        Tin nhắn mất khi rời phòng. Người vào sau không xem được tin trước đó.
      </Text>
      <ScrollView
        ref={log}
        style={styles.log}
        nestedScrollEnabled
        onContentSizeChange={() => log.current?.scrollToEnd({ animated: true })}
      >
        {!chat.messages.length && (
          <Text style={styles.body}>
            Gửi lời chào hoặc câu hỏi cho đối tác.
          </Text>
        )}
        {chat.messages.map((message) => (
          <View
            key={message.id}
            style={[styles.message, message.own && styles.own]}
          >
            <View style={styles.identity}>
              <Avatar
                name={message.own ? "Bạn" : partnerName}
                sourceUri={message.own ? undefined : partnerAvatarUrl}
                size={24}
              />
              <Text style={styles.name}>
                {message.own ? "Bạn" : partnerName}
              </Text>
            </View>
            <Text selectable style={styles.body}>
              {message.text}
            </Text>
          </View>
        ))}
      </ScrollView>
      {!chat.ready && (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {chat.statusMessage}
        </Text>
      )}
      {!!chat.error && (
        <Text accessibilityRole="alert" style={styles.body}>
          {chat.error}
        </Text>
      )}
      <TextInput
        accessibilityLabel="Tin nhắn trong phiên học"
        placeholder="Nhập tin nhắn…"
        placeholderTextColor="#bdc1c6"
        style={styles.input}
        multiline
        maxLength={roomChatTextLimit}
        value={draft}
        onChangeText={setDraft}
        editable={chat.ready && !chat.pending}
      />
      <Button
        disabled={!chat.ready || chat.pending || !draft.trim()}
        onPress={() => {
          const text = draft;
          void chat.send(text).then((sent) => {
            if (sent) setDraft((value) => (value === text ? "" : value));
          });
        }}
      >
        {chat.pending ? "Đang gửi…" : "Gửi tin nhắn"}
      </Button>
    </View>
  );
}
const styles = StyleSheet.create({
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },
  box: { gap: 12, padding: 16, borderRadius: 16, backgroundColor: "#292a2d" },
  heading: { fontFamily: fonts.bold, fontSize: 17, color: "#f1f3f4" },
  notice: { fontFamily: fonts.body, fontSize: 13, color: "#bdc1c6" },
  log: { maxHeight: 220 },
  message: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#3c4043",
    alignSelf: "flex-start",
    maxWidth: "95%",
    marginBottom: 10,
  },
  own: { backgroundColor: "#27445f", alignSelf: "flex-end" },
  name: {
    fontFamily: fonts.semibold,
    color: "#bdc1c6",
    fontSize: 12,
    marginBottom: 4,
  },
  body: { fontFamily: fonts.body, color: "#f1f3f4", fontSize: 15 },
  input: {
    fontFamily: fonts.body,
    color: "#f1f3f4",
    backgroundColor: "#202124",
    borderWidth: 1,
    borderColor: "#5f6368",
    borderRadius: 10,
    padding: 12,
    minHeight: 52,
    maxHeight: 120,
    textAlignVertical: "top",
  },
});
