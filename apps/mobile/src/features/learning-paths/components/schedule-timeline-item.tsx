import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { appColors as colors, appRadius } from "@/constants/theme";

export function ScheduleTimelineItem({
  last,
  children,
}: Readonly<{ last: boolean; children: ReactNode }>) {
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        {!last && (
          <View pointerEvents="none" style={styles.connector}>
            <Svg width="2" height="100%">
              <Line
                x1="1"
                y1="0"
                x2="1"
                y2="100%"
                stroke={colors.primary}
                strokeOpacity={0.5}
                strokeWidth={2}
                strokeDasharray="3 5"
                strokeLinecap="round"
              />
            </Svg>
          </View>
        )}
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
    top: 17,
    bottom: -27,
    width: 2,
  },
  marker: {
    zIndex: 1,
    marginTop: 10,
    width: 14,
    height: 14,
    borderRadius: appRadius.full,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.primarySoft,
  },
  content: { flex: 1, minWidth: 0 },
});
