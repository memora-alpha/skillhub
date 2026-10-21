import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { appColors as colors, appRadius } from "@/constants/theme";

export function ScheduleTimelineItem({
  last,
  children,
}: Readonly<{ last: boolean; children: ReactNode }>) {
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        {!last && <View style={styles.connector} />}
        <View style={styles.marker} />
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  rail: { width: 18, alignItems: "center", position: "relative" },
  connector: {
    position: "absolute",
    top: 14,
    bottom: -30,
    width: 2,
    borderRadius: appRadius.full,
    backgroundColor: colors.borderStrong,
  },
  marker: {
    zIndex: 1,
    marginTop: 12,
    width: 10,
    height: 10,
    borderRadius: appRadius.full,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primarySoft,
  },
  content: { flex: 1, minWidth: 0 },
});
