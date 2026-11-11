import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { LearningSession } from "../types";
import { SessionCopy } from "./session-page";
import {
  SessionSection,
  SessionDisclosure,
  SessionActionRow,
} from "./session-section";
import { sectionStyles as styles } from "./session-section.styles";
import { AttendanceRules } from "./attendance-rules";

export function SessionLimitsPanel({
  session,
  disabled = false,
  children,
}: Readonly<{
  session: LearningSession;
  disabled?: boolean;
  children?: ReactNode;
}>) {
  const router = useRouter();
  const q = session.makeupQuota;
  return (
    <SessionSection title="Quản lý buổi học" icon="settings">
      {(session.rescheduleCount !== undefined || q) && (
        <View style={styles.metrics}>
          {session.rescheduleCount !== undefined && (
            <View style={styles.metric}>
              <Text selectable style={styles.metricValue}>
                {session.rescheduleCount}/3{" "}
                <Text style={styles.caption}>lần</Text>
              </Text>
              <Text style={styles.caption}>Đã đổi lịch</Text>
            </View>
          )}
          {q && (
            <View style={styles.metric}>
              <Text selectable style={styles.metricValue}>
                {q.remaining}/{q.limit} <Text style={styles.caption}>lượt</Text>
              </Text>
              <Text style={styles.caption}>Học bù còn lại</Text>
            </View>
          )}
        </View>
      )}
      {q?.requiresReview && (
        <SessionCopy muted>Cần nhân sự xác minh lượt học bù.</SessionCopy>
      )}
      {children}
      <View style={styles.actionList}>
        <SessionActionRow
          title="Xem thỏa thuận"
          icon="book"
          onPress={() => router.push(`/paths/${session.pathId}`)}
        />
        <SessionActionRow
          title="Báo sự cố"
          icon="flag"
          disabled={disabled}
          onPress={() =>
            router.push({
              pathname: "/reports/new",
              params: { sessionId: session.id },
            })
          }
        />
        <SessionDisclosure title="Quy định buổi học" icon="shield">
          <AttendanceRules session={session} />
        </SessionDisclosure>
      </View>
    </SessionSection>
  );
}
