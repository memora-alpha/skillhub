import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import type { TerminationRequest } from "../api/path-changes-contract";
import { openTermination } from "../utils/termination-policy";
import { TerminationRequestCard } from "./termination-request-card";
import { TerminationHistoryItem } from "./termination-history-item";

export function TerminationRequests({
  requests,
  selectedId,
  blocked,
  refresh,
  beforeHistory,
}: Readonly<{
  requests: TerminationRequest[];
  selectedId?: string;
  blocked: boolean;
  refresh: () => unknown;
  beforeHistory?: ReactNode;
}>) {
  const [historyView, setHistoryView] = useState<{
    selectedId?: string;
    expanded: boolean;
  }>();
  const [receipts, setReceipts] = useState<Record<string, TerminationRequest>>(
    {},
  );
  // Keep a successful response visible even when the subsequent read is slow.
  const rows = requests.map((row) => {
    const receipt = receipts[row.id];
    return receipt && receipt.version >= row.version ? receipt : row;
  });
  const active = rows.filter(openTermination);
  const history = rows.filter((row) => !openTermination(row));
  const selectedHistory = history.some((row) => row.id === selectedId);
  const showHistory =
    historyView?.selectedId === selectedId
      ? (historyView?.expanded ?? selectedHistory)
      : selectedHistory;
  const render = (row: TerminationRequest) => (
    <View key={`${row.id}:${row.version}`} style={styles.entry}>
      {row.id === selectedId && (
        <Text style={styles.selected}>Yêu cầu được mở từ thông báo</Text>
      )}
      <TerminationRequestCard
        request={row}
        blocked={blocked}
        refresh={refresh}
        onUpdated={(receipt) => {
          setReceipts((previous) => ({ ...previous, [receipt.id]: receipt }));
          if (!openTermination(receipt))
            setHistoryView({ selectedId, expanded: true });
        }}
      />
    </View>
  );
  return (
    <>
      {active.length > 0 && (
        <View style={styles.group}>
          <Text accessibilityRole="header" style={styles.heading}>
            Yêu cầu hiện tại
          </Text>
          {active.map(render)}
        </View>
      )}
      {beforeHistory}
      {history.length > 0 && (
        <View style={styles.history}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              showHistory
                ? "Thu gọn lịch sử"
                : `Xem lịch sử (${history.length})`
            }
            accessibilityState={{ expanded: showHistory }}
            onPress={() =>
              setHistoryView({ selectedId, expanded: !showHistory })
            }
            style={({ pressed }) => [
              styles.historyHeading,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Icon name="clock" size={20} color={colors.muted} />
            <View style={styles.historyText}>
              <Text style={styles.historyTitle}>Lịch sử yêu cầu hủy</Text>
              <Text style={styles.count}>
                {history.length} yêu cầu đã kết thúc
              </Text>
            </View>
            <View
              style={{
                transform: [{ rotate: showHistory ? "90deg" : "0deg" }],
              }}
            >
              <Icon name="chevron" size={18} color={colors.muted} />
            </View>
          </Pressable>
          {showHistory && (
            <View style={styles.historyList}>
              {history.map((row) => (
                <TerminationHistoryItem
                  key={`${row.id}:${row.version}:${row.id === selectedId ? "selected" : "history"}`}
                  request={row}
                  selected={row.id === selectedId}
                  defaultExpanded={row.id === selectedId || !!receipts[row.id]}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  entry: { gap: 8 },
  history: { gap: 0, marginTop: 4 },
  historyList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  historyHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 12,
  },
  historyText: { flex: 1, gap: 4 },
  historyTitle: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  heading: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.muted,
    flexShrink: 1,
  },
  count: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.muted,
  },
  selected: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.info,
  },
});
