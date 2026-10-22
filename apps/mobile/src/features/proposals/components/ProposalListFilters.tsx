import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import type { Proposal } from "../api/proposals-api";
import { proposalStatusLabels } from "../constants/proposal-status";

export type ProposalListTab = "all" | Proposal["status"];
const statuses: ProposalListTab[] = [
  "all",
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
];
const directions = [
  { value: "received", label: "Nhận được" },
  { value: "sent", label: "Đã gửi" },
  { value: "all", label: "Tất cả" },
] as const;
export function ProposalListFilters({
  value = "all",
  onChange,
  direction,
  onDirectionChange,
}: Readonly<{
  value?: ProposalListTab;
  onChange: (value: ProposalListTab) => void;
  direction: "sent" | "received" | "all";
  onDirectionChange: (value: "sent" | "received" | "all") => void;
}>) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Đề xuất của bạn</Text>
      <View style={styles.row}>
        <View
          accessibilityRole="tablist"
          accessibilityLabel="Chiều đề xuất"
          style={styles.tabs}
        >
          {directions.map((item) => (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: direction === item.value }}
              aria-selected={direction === item.value}
              onPress={() => onDirectionChange(item.value)}
              style={[styles.tab, direction === item.value && styles.selected]}
            >
              <Text
                style={[
                  styles.label,
                  direction === item.value && styles.active,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Lọc theo trạng thái"
          accessibilityState={{ expanded, selected: value !== "all" }}
          aria-expanded={expanded}
          onPress={() => setExpanded(!expanded)}
          style={[
            styles.filter,
            (expanded || value !== "all") && styles.selected,
          ]}
        >
          <Icon
            name="filter"
            size={18}
            color={expanded || value !== "all" ? colors.primary : colors.body}
          />
          {value !== "all" && <View style={styles.dot} />}
        </Pressable>
      </View>
      {!expanded && value !== "all" && (
        <Text style={styles.caption}>
          Trạng thái: {proposalStatusLabels[value]}
        </Text>
      )}
      {expanded && (
        <View
          accessibilityRole="tablist"
          accessibilityLabel="Bộ lọc trạng thái đề xuất"
          style={styles.options}
        >
          {statuses.map((status) => (
            <Pressable
              key={status}
              accessibilityRole="tab"
              accessibilityState={{ selected: value === status }}
              aria-selected={value === status}
              onPress={() => {
                onChange(status);
                setExpanded(false);
              }}
              style={[styles.option, value === status && styles.selected]}
            >
              <Text style={[styles.label, value === status && styles.active]}>
                {status === "all"
                  ? "Tất cả trạng thái"
                  : proposalStatusLabels[status]}
              </Text>
              {value === status && (
                <Icon name="check" size={16} color={colors.primary} />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 12 },
  eyebrow: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.muted,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  tabs: { flexDirection: "row", flex: 1, gap: 6 },
  tab: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderRadius: appRadius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.body,
  },
  selected: {
    borderColor: colors.primaryMuted,
    backgroundColor: colors.primarySoft,
  },
  active: { color: colors.primary, fontFamily: fonts.bold },
  filter: {
    width: 44,
    minHeight: 44,
    borderRadius: appRadius.button,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  dot: {
    position: "absolute",
    right: 7,
    top: 7,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  caption: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  options: {
    padding: 6,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.control,
    backgroundColor: colors.surface,
  },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: appRadius.button,
  },
});
