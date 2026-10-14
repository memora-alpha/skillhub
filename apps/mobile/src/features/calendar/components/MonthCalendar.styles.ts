import { StyleSheet } from "react-native";
import { typography, fonts } from "@/constants/theme";
import {
  calendarColors as colors,
  calendarCardShadow,
} from "../constants/theme";

export const styles = StyleSheet.create({
  card: {
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: calendarCardShadow,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  arrows: { flexDirection: "row", gap: 2 },
  arrow: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  month: {
    fontFamily: fonts.bold,
    ...typography.caption,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: colors.muted,
  },
  week: { flexDirection: "row" },
  weekDay: {
    flex: 1,
    fontFamily: fonts.semibold,
    color: colors.muted,
    ...typography.caption,
    paddingVertical: 3,
    textAlign: "center",
  },
  grid: { gap: 3 },
  cell: {
    flex: 1,
    minWidth: 0,
    height: 36,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  day: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  dayText: {
    fontFamily: fonts.medium,
    color: colors.body,
    ...typography.secondary,
    fontVariant: ["tabular-nums"],
  },
  circled: {
    borderColor: colors.orange,
    borderWidth: 1.5,
  },
  dayDot: {
    position: "absolute",
    bottom: -4,
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.orange,
  },
  selectedDayDot: { bottom: 3 },
});
