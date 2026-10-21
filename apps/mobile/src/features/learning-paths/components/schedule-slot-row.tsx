import { Text, View } from "react-native";
import { styles } from "./schedule-read-styles";

export function ScheduleSlotRow({
  slot,
  title,
  status,
}: Readonly<{
  slot: { sessionNo: number; startAt?: string; endAt?: string };
  title: string;
  status?: string;
}>) {
  if (!slot.startAt || !slot.endAt)
    return (
      <View style={styles.slot}>
        <Text style={styles.slotTitle}>
          {`Buổi ${slot.sessionNo}${title.trim() ? ` · ${title.trim()}` : ""}`}
        </Text>
        <Text style={styles.secondary}>
          Chưa có ngày giờ · Cần bổ sung lịch
        </Text>
      </View>
    );
  const start = new Date(slot.startAt),
    end = new Date(slot.endAt);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const timeOptions = { hour: "2-digit", minute: "2-digit" } as const;
  const endLabel =
    start.toDateString() === end.toDateString()
      ? end.toLocaleTimeString("vi-VN", timeOptions)
      : end.toLocaleString("vi-VN", {
          ...timeOptions,
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
  return (
    <View style={styles.slot}>
      <Text style={styles.slotTitle}>
        {`Buổi ${slot.sessionNo}${title.trim() ? ` · ${title.trim()}` : ""}`}
      </Text>
      <View style={styles.slotDetails}>
        <View style={styles.dateTile}>
          <Text style={styles.sessionNumber}>
            {start.toLocaleDateString("vi-VN", { weekday: "short" })}
          </Text>
          <Text style={styles.day}>{start.getDate()}</Text>
        </View>
        <View style={styles.grow}>
          <Text style={styles.date}>
            {`Tháng ${start.getMonth() + 1}, ${start.getFullYear()}`}
          </Text>
          <Text style={styles.secondary}>
            {start.toLocaleTimeString("vi-VN", timeOptions)} – {endLabel}
          </Text>
          {!!status && <Text style={styles.secondary}>{status}</Text>}
        </View>
        <Text style={styles.duration}>{minutes} phút</Text>
      </View>
    </View>
  );
}
