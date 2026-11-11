import { StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import type { LearningSession } from "../types";
import { attendanceSideText } from "../utils/attendance-presentation";

function attendanceDuration(seconds: bigint) {
  if (seconds >= 60n) return `${seconds / 60n} phút`;
  if (seconds > 0n) return "Dưới 1 phút";
  return undefined;
}

export function SessionAttendanceSummary({
  attendance,
}: Readonly<{ attendance: LearningSession["attendance"] }>) {
  return (
    <View>
      {(["teacher", "learner"] as const).map((role) => {
        const side = attendance?.[role];
        if (!side) return null;
        const label = role === "teacher" ? "Người dạy" : "Người học";
        const known = side.verdict === "PRESENT" || side.verdict === "ABSENT";
        const seconds = known ? BigInt(side.seconds) : 0n;
        const duration = attendanceDuration(seconds);
        const status = {
          PRESENT: "Có mặt",
          ABSENT: "Vắng mặt",
          UNVERIFIABLE: "Chưa xác minh",
        }[side.verdict ?? "UNVERIFIABLE"];
        return (
          <View
            key={role}
            style={[styles.row, role === "learner" && styles.lastRow]}
          >
            <View style={styles.avatar}>
              <Icon name="user" size={18} color={colors.forest} />
            </View>
            <View style={styles.identity}>
              <Text style={styles.label}>{label}</Text>
              {(duration || (known && side.late)) && (
                <Text style={styles.meta}>
                  {[duration, known && side.late ? "Vào muộn" : undefined]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              )}
            </View>
            <Text
              accessibilityLabel={`${label}: ${attendanceSideText(side)}`}
              style={[
                styles.status,
                side.verdict === "PRESENT" && styles.present,
                side.verdict === "ABSENT" && styles.absent,
              ]}
            >
              {side.verdict ? status : "Chờ cập nhật"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  lastRow: { borderBottomWidth: 0 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: appRadius.full,
    backgroundColor: colors.forestSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  identity: { flex: 1, minWidth: 0, gap: 3 },
  label: { fontFamily: fonts.semibold, ...typography.body, color: colors.ink },
  meta: { fontFamily: fonts.body, ...typography.secondary, color: colors.body },
  status: {
    flexShrink: 1,
    maxWidth: "45%",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: appRadius.badge,
    overflow: "hidden",
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.body,
    backgroundColor: colors.surfaceLow,
    textAlign: "center",
  },
  present: { color: colors.forest, backgroundColor: colors.forestSoft },
  absent: { color: colors.warning, backgroundColor: colors.warningLight },
});
