import { Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import type { LearningSession } from "../types";
import { confirmationLabel } from "../utils/session-policy";
import { detailStyles as styles } from "./session-detail.styles";

export function SessionConfirmations({
  session,
  userId,
}: {
  session: LearningSession;
  userId: string;
}) {
  const teacher = session.teacherId === userId;
  const confirmations = [
    {
      label: "Bạn",
      value: teacher
        ? session.teacherConfirmationStatus
        : session.learnerConfirmationStatus,
    },
    {
      label: "Đối tác",
      value: teacher
        ? session.learnerConfirmationStatus
        : session.teacherConfirmationStatus,
    },
  ];
  return (
    <View style={styles.confirmation}>
      <View style={styles.sectionHeading}>
        <Icon name="check-circle" size={18} color={colors.forest} />
        <Text accessibilityRole="header" style={styles.confirmationTitle}>
          Xác nhận hoàn thành buổi học
        </Text>
      </View>
      {confirmations.map(({ label, value }) => (
        <View key={label} style={styles.confirmationRow}>
          <Icon
            name={
              value === "CONFIRMED"
                ? "check-circle"
                : value === null
                  ? "clock"
                  : "alert"
            }
            size={16}
            color={value === "CONFIRMED" ? colors.forest : colors.muted}
          />
          <Text style={styles.confirmationText}>
            {label}: {confirmationLabel(value)}
          </Text>
        </View>
      ))}
    </View>
  );
}
