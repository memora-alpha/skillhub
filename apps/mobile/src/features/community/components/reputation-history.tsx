import { Text, View } from "react-native";
import { appColors as colors } from "@/constants/theme";
import type { Reputation } from "../api/community-api";
import { reputationHistoryGroups } from "../utils/reputation-history";
import { reputationReasons } from "./reputation-summary";
import { historyStyles as styles } from "./reputation-history.styles";

export function ReputationHistory({
  items,
}: Readonly<{ items: Reputation["items"] }>) {
  return (
    <View style={styles.stack}>
      <View style={styles.headingRow}>
        <Text accessibilityRole="header" style={styles.heading}>
          Thay đổi điểm
        </Text>
        {!!items.length && (
          <Text style={styles.caption}>{items.length} đã tải</Text>
        )}
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
              const color = positive
                ? colors.forest
                : row.delta < 0
                  ? colors.error
                  : colors.muted;
              const backgroundColor = positive
                ? colors.forestSoft
                : row.delta < 0
                  ? colors.errorLight
                  : colors.surfaceInset;
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
