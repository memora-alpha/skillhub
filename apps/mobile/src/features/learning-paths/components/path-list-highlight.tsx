import { StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import type { PathOverviewCard } from "../api/path-overview-contract";
import {
  attentionTitle,
  pathDate,
  waitingOnLabels,
} from "../utils/path-overview-presentation";

// A list card shows one useful update. Full progress and case details live in the path.
export function PathListHighlight({
  overview,
}: Readonly<{ overview: PathOverviewCard }>) {
  const attention = overview.primaryAttention;
  const next = overview.nextSession;
  let icon: IconName = "book";
  let title: string | undefined;
  let detail: string | undefined;
  if (attention) {
    icon = "alert";
    title = attentionTitle(attention);
    detail = waitingOnLabels[attention.waitingOn] ?? waitingOnLabels.UNKNOWN;
  } else if (next) {
    icon = "calendar";
    title = `Buổi tiếp theo · Bạn ${next.role === "TEACHER" ? "dạy" : "học"}`;
    detail = pathDate(next.startAt);
  } else if (overview.progress.basis === "LOCKED_AGREEMENT") {
    const { learning, teaching } = overview.progress;
    title = [
      learning && `Bạn học ${learning.completed}/${learning.total} buổi`,
      teaching && `Bạn dạy ${teaching.completed}/${teaching.total} buổi`,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (!title) return null;
  return (
    <View style={[styles.row, attention && styles.attention]}>
      <Icon
        name={icon}
        size={18}
        color={attention ? colors.warning : colors.primary}
      />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {detail && <Text style={styles.detail}>{detail}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: appRadius.control,
    backgroundColor: colors.surfaceLow,
  },
  attention: { backgroundColor: colors.amberSoft },
  content: { flex: 1, minWidth: 0, gap: 2 },
  title: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  detail: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.body,
  },
});
