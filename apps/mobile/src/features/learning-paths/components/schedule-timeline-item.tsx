import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { appColors as colors, appRadius } from "@/constants/theme";

export function ScheduleTimelineItem({
  last,
  children,
  gap = 10,
}: Readonly<{ last: boolean; children: ReactNode; gap?: number }>) {
  const [rowHeight, setRowHeight] = useState(0);
  const connectorHeight = rowHeight + gap;
  return (
    <View
      style={styles.row}
      onLayout={(event) => setRowHeight(event.nativeEvent.layout.height)}
    >
      <View style={styles.rail}>
        {!last && rowHeight > 0 && (
          <View
            pointerEvents="none"
            style={[styles.connector, { height: connectorHeight }]}
          >
            <Svg width={2} height={connectorHeight}>
              <Line
                x1="1"
                y1="0"
                x2="1"
                y2={connectorHeight}
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
