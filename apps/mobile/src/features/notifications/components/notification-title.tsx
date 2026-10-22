import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";

export function NotificationTitle({
  text,
  style,
  animate,
}: {
  text: string;
  style: StyleProp<TextStyle>;
  animate: boolean;
}) {
  const offset = useRef(new Animated.Value(0)).current;
  const [frameWidth, setFrameWidth] = useState(0);
  const [measurement, setMeasurement] = useState({ text: "", width: 0 });
  const title = text.replace(/\s+/g, " ").trim();
  const textWidth = measurement.text === title ? measurement.width : 0;
  const distance = Math.max(0, textWidth - frameWidth);
  const scrolling = animate && frameWidth > 0 && distance > 1;

  useEffect(() => {
    offset.setValue(0);
    if (!scrolling) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(offset, {
          toValue: -distance,
          duration: Math.max(2000, (distance / 24) * 1000),
          easing: Easing.linear,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.delay(1800),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
      offset.setValue(0);
    };
  }, [distance, offset, scrolling, title]);

  return (
    <View
      style={styles.frame}
      onLayout={(event) => setFrameWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.track,
          !scrolling && styles.measurement,
          { transform: [{ translateX: offset }] },
        ]}
      >
        <Text
          key={title}
          numberOfLines={1}
          style={[style, styles.text]}
          onLayout={(event) =>
            setMeasurement({
              text: title,
              width: event.nativeEvent.layout.width,
            })
          }
        >
          {title}
        </Text>
      </Animated.View>
      {!scrolling && (
        <Text numberOfLines={1} ellipsizeMode="tail" style={style}>
          {title}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, minWidth: 0, overflow: "hidden" },
  track: { flexDirection: "row", alignSelf: "flex-start" },
  text: { flexShrink: 0 },
  measurement: { position: "absolute", opacity: 0 },
});
