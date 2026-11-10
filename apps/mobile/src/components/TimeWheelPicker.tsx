import { useEffect, useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from "react-native";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";

const rowHeight = 48;

function TimeColumn({
  label,
  value,
  count,
  onChange,
}: Readonly<{
  label: string;
  value: number;
  count: number;
  onChange: (value: number) => void;
}>) {
  const scroll = useRef<ScrollViewInstance>(null);
  const offset = useRef(value * rowHeight);
  const initialized = useRef(false);
  const selected = useRef(value);
  selected.current = value;
  const choose = (next: number) => {
    if (next === selected.current) return;
    selected.current = next;
    onChange(next);
  };
  useEffect(() => {
    // A wheel updates its value while scrolling. Only scroll programmatically
    // for a tap, accessibility action or a change from outside this column.
    if (Math.abs(offset.current - value * rowHeight) > rowHeight / 2) {
      offset.current = value * rowHeight;
      scroll.current?.scrollTo({ y: offset.current, animated: false });
    }
  }, [value]);
  return (
    <View style={styles.column}>
      <Text style={styles.label}>{label}</Text>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{
          min: 0,
          max: count - 1,
          now: value,
          text: String(value).padStart(2, "0"),
        }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={({ nativeEvent }) => {
          const delta =
            nativeEvent.actionName === "increment"
              ? 1
              : nativeEvent.actionName === "decrement"
                ? -1
                : 0;
          if (delta)
            choose(Math.max(0, Math.min(count - 1, selected.current + delta)));
        }}
        style={styles.wheel}
      >
        <View pointerEvents="none" style={styles.selection} />
        <ScrollView
          ref={scroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={rowHeight}
          decelerationRate="fast"
          contentContainerStyle={styles.options}
          onContentSizeChange={() => {
            if (initialized.current) return;
            offset.current = value * rowHeight;
            scroll.current?.scrollTo({ y: offset.current, animated: false });
            initialized.current = true;
          }}
          scrollEventThrottle={16}
          onScroll={({ nativeEvent }) => {
            if (!initialized.current) return;
            offset.current = nativeEvent.contentOffset.y;
            const next = Math.max(
              0,
              Math.min(count - 1, Math.round(offset.current / rowHeight)),
            );
            choose(next);
          }}
        >
          {Array.from({ length: count }, (_, number) => (
            <Pressable
              key={number}
              accessible={false}
              onPress={() => choose(number)}
              style={styles.option}
            >
              <Text
                style={[styles.number, number === value && styles.selected]}
              >
                {String(number).padStart(2, "0")}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

// Expo UI's Android time picker is a clock or text input; its Picker wheel
// appearance falls back to a dropdown. Use snapping columns for swipe selection.
export function TimeWheelPicker({
  value,
  onChange,
}: Readonly<{
  value: Date;
  onChange: (date: Date) => void;
}>) {
  const latest = useRef(value);
  latest.current = value;
  const choose = (part: "hours" | "minutes", selected: number) => {
    // Native scroll events from both columns can arrive before React commits.
    // Compose them with the last emitted date, not a stale render's other part.
    const next = new Date(latest.current);
    if (part === "hours") next.setHours(selected);
    else next.setMinutes(selected);
    next.setSeconds(0, 0);
    latest.current = next;
    onChange(next);
  };
  return (
    <View style={styles.picker}>
      <TimeColumn
        label="Giờ"
        count={24}
        value={value.getHours()}
        onChange={(hours) => choose("hours", hours)}
      />
      <TimeColumn
        label="Phút"
        count={60}
        value={value.getMinutes()}
        onChange={(minutes) => choose("minutes", minutes)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { flexDirection: "row", gap: 12 },
  column: { flex: 1, minWidth: 0, gap: 4 },
  label: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.muted,
    textAlign: "center",
  },
  wheel: { height: rowHeight * 3, overflow: "hidden" },
  selection: {
    position: "absolute",
    top: rowHeight,
    height: rowHeight,
    left: 0,
    right: 0,
    backgroundColor: colors.primarySoft,
    borderRadius: appRadius.control,
  },
  options: { paddingVertical: rowHeight },
  option: { height: rowHeight, alignItems: "center", justifyContent: "center" },
  number: { ...typography.body, fontFamily: fonts.body, color: colors.muted },
  selected: { color: colors.primary, fontFamily: fonts.bold },
});
