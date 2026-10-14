import { Text, View } from "react-native";
import { Badge } from "@/components/Badge";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import { SessionPanel, SessionCopy, SessionRouteButton } from "./session-page";
import { sessionUi as styles } from "./session-page.styles";
import { useSessionsRuntime } from "../runtime";
import type { LearningSession } from "../types";
import { sessionPresentation } from "../utils/session-presentation";
import { formatSessionTime, sessionDuration } from "../utils/session-time";

export function SessionCard({
  session,
  timezone,
}: {
  session: LearningSession;
  timezone: string;
}) {
  const { userId } = useSessionsRuntime();
  const presentation = sessionPresentation(session);
  const label =
    presentation.label === "Đã kết thúc · chờ xác nhận"
      ? "Chờ xác nhận"
      : presentation.label;
  return (
    <SessionPanel>
      <View style={styles.cardHeader}>
        <Text accessibilityRole="header" style={styles.heading}>
          Buổi học
        </Text>
        <View style={styles.badge}>
          <Badge label={label} variant={presentation.variant} />
        </View>
      </View>
      <View style={styles.metadata}>
        <Icon name="calendar" size={18} color={colors.primary} />
        <View style={styles.grow}>
          <SessionCopy>
            {formatSessionTime(session.startAt, timezone)}
          </SessionCopy>
          <SessionCopy muted>
            Bạn {session.teacherId === userId ? "dạy" : "học"} ·{" "}
            {sessionDuration(session)} phút
          </SessionCopy>
        </View>
      </View>
      <SessionRouteButton href={`/learning-sessions/${session.id}`}>
        Mở buổi học
      </SessionRouteButton>
    </SessionPanel>
  );
}
