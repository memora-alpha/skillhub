import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import {
  caseMessageTimeline,
  type CaseMessage,
} from "../utils/case-message-timeline";
import { caseThreadStyles as s } from "./case-thread.styles";

export function CaseMessageHistory({
  messages,
  userId,
  hasMore,
  loading,
  onLoadOlder,
}: Readonly<{
  messages: readonly CaseMessage[];
  userId: string | null;
  hasMore: boolean;
  loading: boolean;
  onLoadOlder: () => void;
}>) {
  const timeline = useMemo(() => caseMessageTimeline(messages), [messages]);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? timeline : timeline.slice(-3);
  if (!timeline.length) return null;
  return (
    <View style={s.history}>
      {(timeline.length > 3 || hasMore) && (
        <Button
          variant="ghost"
          style={s.historyAction}
          accessibilityState={{ expanded }}
          onPress={() => {
            setExpanded(!expanded);
            if (!expanded && timeline.length <= 3 && hasMore) onLoadOlder();
          }}
        >
          {expanded ? "Thu gọn trao đổi" : "Xem trao đổi trước"}
        </Button>
      )}
      {expanded && hasMore && (
        <Button variant="paper" disabled={loading} onPress={onLoadOlder}>
          {loading ? "Đang tải…" : "Tin nhắn trước"}
        </Button>
      )}
      {visible.map((row, index) => (
        <View key={row.message.id} style={s.history}>
          {(row.startsDay || index === 0) && (
            <Text style={s.day}>{row.day}</Text>
          )}
          <View style={s.messageGroup}>
            <View style={[s.bubble, row.message.senderId === userId && s.mine]}>
              <Text style={s.sender}>
                {row.message.senderId === userId ? "Bạn" : "Nhân viên hỗ trợ"}
              </Text>
              <Text selectable style={s.message}>
                {row.message.text}
              </Text>
            </View>
            <Text
              accessibilityLabel={`Gửi lúc ${row.time}`}
              style={[s.time, row.message.senderId === userId && s.mineTime]}
            >
              {row.time}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
