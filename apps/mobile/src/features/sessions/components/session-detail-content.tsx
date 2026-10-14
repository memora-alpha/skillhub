import { Pressable, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import type { LearningSession } from "../types";
import { sessionPresentation } from "../utils/session-presentation";
import { sessionDuration, formatSessionTime } from "../utils/session-time";
import { sessionSchedule } from "../utils/session-schedule";
import { SessionConfirmations } from "./session-confirmations";
import { detailStyles as styles } from "./session-detail.styles";

type Props = {
  session: LearningSession;
  userId: string;
  timezone: string;
  partner?: { fullName: string; avatarUrl: string | null };
  onOpenPartner: () => void;
};

export function SessionDetailContent({
  session,
  userId,
  timezone,
  partner,
  onOpenPartner,
}: Props) {
  const teacher = session.teacherId === userId;
  const presentation = sessionPresentation(session);
  const schedule = sessionSchedule(session, timezone);
  const ended = Date.parse(session.endAt) <= Date.now();
  const blocked = ["CANCELLED", "DISPUTED"].includes(session.status);
  const warning = presentation.variant === "warning";
  const neutral = session.status === "CANCELLED";
  const statusLabel =
    presentation.label === "Đã kết thúc · chờ xác nhận"
      ? "Chờ xác nhận"
      : presentation.label;
  return (
    <>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.topRow}>
            <View style={styles.eyebrow}>
              <Text style={styles.eyebrowText}>LỊCH 1-KÈM-1</Text>
            </View>
            <View
              style={[
                styles.status,
                warning && styles.warningStatus,
                neutral && styles.neutralStatus,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: neutral
                      ? colors.muted
                      : warning
                        ? colors.warning
                        : colors.forest,
                  },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  warning && styles.warningText,
                  neutral && styles.neutralText,
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            Thông tin buổi học
          </Text>
        </View>
        <View style={styles.schedule}>
          <View style={styles.dateTile}>
            <Text style={styles.dateNumber}>{schedule.day}</Text>
            <Text style={styles.dateMonth}>TH. {schedule.month}</Text>
          </View>
          <View style={styles.grow}>
            <Text style={styles.label}>THỜI GIAN BUỔI HỌC</Text>
            <Text selectable style={styles.time}>
              {schedule.time}
            </Text>
            <Text selectable style={styles.date}>
              {schedule.date}
            </Text>
            <View style={styles.duration}>
              <Icon name="clock" size={14} color={colors.body} />
              <Text selectable style={styles.durationValue}>
                {sessionDuration(session)} phút
              </Text>
            </View>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xem hồ sơ đối tác"
          onPress={onOpenPartner}
          style={({ pressed }) => [
            styles.partner,
            pressed && { opacity: 0.75 },
          ]}
        >
          <Avatar
            name={partner?.fullName || "Đối tác"}
            userId={teacher ? session.learnerId : session.teacherId}
            sourceUri={partner?.avatarUrl}
            size={48}
          />
          <View style={styles.grow}>
            <Text style={styles.partnerRole}>
              ĐỐI TÁC · {teacher ? "NGƯỜI HỌC" : "NGƯỜI DẠY"}
            </Text>
            <Text style={styles.value}>
              {partner?.fullName || "Chưa có thông tin đối tác"}
            </Text>
          </View>
          <Icon name="chevron" size={18} color={colors.muted} />
        </Pressable>
        {((session.status === "CANCELLED" && session.cancelReason) ||
          session.cancelledAt) && (
          <View style={styles.cancellation}>
            <View style={styles.sectionHeading}>
              <Icon name="close" size={18} color={colors.error} />
              <Text accessibilityRole="header" style={styles.cancellationTitle}>
                Thông tin hủy
              </Text>
            </View>
            {session.status === "CANCELLED" && session.cancelReason && (
              <Text selectable style={styles.guidance}>
                Lý do hủy: {session.cancelReason}
              </Text>
            )}
            {session.cancelledAt && (
              <Text style={styles.secondary}>
                Đã hủy lúc {formatSessionTime(session.cancelledAt, timezone)}
              </Text>
            )}
          </View>
        )}
        {ended && !blocked && (
          <SessionConfirmations session={session} userId={userId} />
        )}
      </View>
      <View style={styles.notice}>
        <Icon name="shield" size={18} color={colors.warning} />
        <View style={styles.grow}>
          <Text style={styles.guidance}>{presentation.description}</Text>
        </View>
      </View>
      {!ended && !blocked && (
        <View style={styles.room}>
          <View style={styles.roomIcon}>
            <Icon name="video" size={20} color={colors.white} />
          </View>
          <View style={styles.grow}>
            <Text style={styles.roomLabel}>Phòng học trực tuyến</Text>
            <Text style={styles.roomDescription}>Chưa khả dụng</Text>
          </View>
          <Icon name="lock" size={16} color={colors.error} />
        </View>
      )}
    </>
  );
}
