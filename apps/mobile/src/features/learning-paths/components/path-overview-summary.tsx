import { StyleSheet, Text, View } from "react-native";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import type { PathOverviewCard } from "../api/path-overview-contract";
import {
  learningStageLabel,
  pathDate,
} from "../utils/path-overview-presentation";

export function hasOverviewSummary(overview: PathOverviewCard) {
  return !!(
    overview.learningStage ||
    overview.nextSession ||
    overview.progress.learning?.total ||
    overview.progress.teaching?.total
  );
}

export function PathOverviewSummary({
  overview,
}: Readonly<{
  overview: PathOverviewCard;
}>) {
  const { progress, nextSession } = overview;
  const stage = learningStageLabel(overview.learningStage);
  if (!hasOverviewSummary(overview)) return null;
  const status =
    nextSession &&
    (
      {
        ONGOING: "Đang diễn ra",
        READY: "Sẵn sàng bắt đầu",
        CONFIRMED: "Đã xác nhận lịch",
      } as Record<string, string>
    )[nextSession.status];
  return (
    <View style={styles.summary}>
      {stage && <Text style={styles.stage}>{stage}</Text>}
      {!!(progress.learning?.total || progress.teaching?.total) && (
        <View style={styles.progress}>
          {progress.learning && progress.learning.total > 0 && (
            <ProgressRow label="Bạn học" count={progress.learning} />
          )}
          {progress.teaching && progress.teaching.total > 0 && (
            <ProgressRow label="Bạn dạy" count={progress.teaching} />
          )}
        </View>
      )}
      {nextSession && (
        <View style={styles.next}>
          <View style={styles.heading}>
            <Text style={styles.label}>
              Buổi tiếp theo · Bạn{" "}
              {nextSession.role === "TEACHER" ? "dạy" : "học"}
            </Text>
            {status && <Text style={styles.status}>{status}</Text>}
          </View>
          <Text style={styles.date}>{pathDate(nextSession.startAt)}</Text>
        </View>
      )}
    </View>
  );
}
function ProgressRow({
  label,
  count,
}: Readonly<{
  label: string;
  count: { completed: number; total: number };
}>) {
  return (
    <View style={styles.progressItem}>
      <View style={styles.heading}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.count}>
          {count.completed}/{count.total} buổi
        </Text>
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: count.total, now: count.completed }}
      >
        <View
          style={[
            styles.fill,
            { width: `${(count.completed / count.total) * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  summary: { gap: 14 },
  stage: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.forest,
  },
  progress: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  progressItem: { flex: 1, minWidth: 120, gap: 8 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 6,
  },
  label: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.body,
  },
  count: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  track: {
    height: 4,
    borderRadius: appRadius.full,
    backgroundColor: colors.surfaceInset,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: colors.forest,
    borderRadius: appRadius.full,
  },
  next: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 8,
  },
  status: {
    ...typography.caption,
    fontFamily: fonts.medium,
    color: colors.forest,
  },
  date: { ...typography.body, fontFamily: fonts.semibold, color: colors.ink },
});
