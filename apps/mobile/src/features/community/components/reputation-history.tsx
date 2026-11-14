import { Text, View } from "react-native";
import { appColors as colors } from "@/constants/theme";
import type { Reputation } from "../api/community-api";
import { reputationHistoryGroups } from "../utils/reputation-history";
import { reputationReasons } from "../utils/reputation-presentation";
import { historyStyles as styles } from "./reputation-history.styles";

function deltaColors(delta: number) {
  if (delta > 0)
    return { color: colors.forest, backgroundColor: colors.forestSoft };
  if (delta < 0)
    return { color: colors.error, backgroundColor: colors.errorLight };
  return { color: colors.muted, backgroundColor: colors.surfaceInset };
}

export function ReputationHistory({
  items,
  title = "Thay đổi điểm",
}: Readonly<{ items: Reputation["items"]; title?: string }>) {
  return (
    <View style={styles.stack}>
      <View style={styles.headingRow}>
        <Text accessibilityRole="header" style={styles.heading}>
          {title}
        </Text>
      </View>
      {!items.length && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Chưa có thay đổi điểm</Text>
          <Text style={styles.emptyText}>
            Lịch sử sẽ xuất hiện khi hệ thống ghi nhận thay đổi uy tín.
          </Text>
        </View>
      )}
      {reputationHistoryGroups(items).map((group) => (
        <View key={group.date} style={styles.day}>
          <Text style={styles.dayLabel}>{group.label}</Text>
          <View style={styles.card}>
            {group.items.map((row, index) => {
              const positive = row.delta > 0;
              const { color, backgroundColor } = deltaColors(row.delta);
              const last = index === group.items.length - 1;
              return (
                <View key={row.id} style={styles.event}>
                  <View style={styles.rail}>
                    <View style={[styles.dot, { backgroundColor: color }]} />
                    {!last && <View style={styles.line} />}
                  </View>
                  <View style={[styles.eventBody, last && styles.lastEvent]}>
                    <View style={styles.eventHeader}>
                      <Text style={styles.eventTitle}>
                        {reputationReasons[row.reasonCode] ??
                          "Điều chỉnh uy tín"}
                      </Text>
                      <View style={[styles.deltaBadge, { backgroundColor }]}>
                        <Text style={[styles.delta, { color }]}>
                          {positive ? "+" : ""}
                          {row.delta}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.meta}>
                      {row.scoreBefore} → {row.scoreAfter} điểm
                    </Text>
                    <Text style={styles.meta}>
                      {new Date(row.createdAt).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
