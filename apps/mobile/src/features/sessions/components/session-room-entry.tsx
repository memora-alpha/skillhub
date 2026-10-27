import { Text, View } from "react-native";
import { Button } from "@/components/Button";
import { detailStyles as styles } from "./session-detail.styles";
import type { LearningSession } from "../types";
import { useSessionClock } from "../hooks/use-session-clock";
import {
  canJoinSession,
  joinReason,
  sessionJoinReason,
} from "../utils/session-join";

export function SessionRoomEntry({
  session,
  onJoin,
}: Readonly<{ session: LearningSession; onJoin: () => void }>) {
  const now = useSessionClock(session);
  if (["CANCELLED", "COMPLETED", "DISPUTED"].includes(session.status))
    return null;
  const allowed = canJoinSession(session, now);
  return (
    <View style={styles.room}>
      <View style={styles.grow}>
        <Text style={styles.roomLabel}>Phòng học trực tuyến</Text>
        <Text style={styles.roomDescription}>
          {allowed
            ? "Phòng học đã mở. Bạn có thể vào học hoặc kết nối lại."
            : joinReason(sessionJoinReason(session, now))}
        </Text>
        <Button
          leadingIcon="video"
          disabled={!allowed}
          onPress={() => {
            if (canJoinSession(session)) onJoin();
          }}
        >
          Vào phòng học
        </Button>
      </View>
    </View>
  );
}
