import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import type { Proposal } from "../api/proposals-api";
import { proposalStatusLabels } from "../constants/proposal-status";

const statuses = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
] as const;
export type ProposalListTab = "all" | Proposal["status"];
const tabs = [
  { value: "all", label: "Xem tất cả" },
  ...statuses.map((value) => ({ value, label: proposalStatusLabels[value] })),
] as const;

export function ProposalListFilters({
  value,
  onChange,
}: {
  value?: ProposalListTab;
  onChange: (value: ProposalListTab) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel="Bộ lọc đề xuất"
      contentContainerStyle={styles.statuses}
      style={styles.statusRow}
    >
      {tabs.map((item) => (
        <Pressable
          key={item.value}
          accessibilityRole="tab"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: value === item.value }}
          aria-selected={value === item.value}
          onPress={() => onChange(item.value)}
          style={({ pressed }) => [
            styles.tab,
            value === item.value && styles.activeTab,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[styles.label, value === item.value && styles.activeLabel]}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  statusRow: { borderBottomWidth: 1, borderBottomColor: colors.border },
  statuses: { flexDirection: "row", gap: 24 },
  tab: {
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: { borderBottomColor: colors.primary },
  label: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.muted,
  },
  activeLabel: { color: colors.primary, fontFamily: fonts.bold },
  pressed: { opacity: 0.65 },
});
