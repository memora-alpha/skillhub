import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  iconSizes,
  typography,
} from "@/constants/theme";

const stars = [1, 2, 3, 4, 5] as const;
const labels = [
  "Chạm để chọn số sao",
  "Chưa hài lòng",
  "Cần cải thiện",
  "Tạm ổn",
  "Hài lòng",
  "Rất hài lòng",
];

export function ReviewStars({
  rating,
  size = iconSizes.inline,
}: Readonly<{ rating: number; size?: number }>) {
  return (
    <View
      accessible
      accessibilityLabel={`${rating.toLocaleString("vi-VN")} trên 5 sao`}
      style={styles.stars}
    >
      {stars.map((star) => (
        <View key={star}>
          <Icon
            name="star"
            size={size}
            color={colors.borderStrong}
            filled={false}
          />
          <View
            style={[
              styles.fill,
              {
                width: `${Math.max(0, Math.min(1, rating - star + 1)) * 100}%`,
              },
            ]}
          >
            <Icon name="star" size={size} color={colors.star} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function ReviewRatingPicker({
  value,
  onChange,
  disabled = false,
  compact = false,
}: Readonly<{
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  compact?: boolean;
}>) {
  return (
    <View style={[styles.picker, compact && styles.compactPicker]}>
      {!compact && (
        <Text style={styles.label}>Trải nghiệm của bạn thế nào?</Text>
      )}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Số sao đánh giá"
        style={[styles.choices, compact && styles.compactChoices]}
      >
        {stars.map((star) => (
          <Pressable
            key={star}
            accessibilityRole="radio"
            accessibilityLabel={`${star} sao · ${labels[star]}`}
            accessibilityState={{ checked: value === star, disabled }}
            aria-checked={value === star}
            disabled={disabled}
            onPress={() => onChange(star)}
            onKeyDown={
              Platform.OS === "web"
                ? (event) => {
                    if (disabled) return;
                    const key = event.nativeEvent.key;
                    if (key === " " || key === "Spacebar") {
                      event.preventDefault();
                      onChange(star);
                    } else if (
                      [
                        "ArrowLeft",
                        "ArrowRight",
                        "ArrowUp",
                        "ArrowDown",
                      ].includes(key)
                    ) {
                      event.preventDefault();
                      const next =
                        (star -
                          1 +
                          (key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1) +
                          stars.length) %
                        stars.length;
                      onChange(stars[next]!);
                      const target = event.currentTarget;
                      if (target instanceof HTMLElement)
                        target
                          .closest('[role="radiogroup"]')
                          ?.querySelectorAll<HTMLElement>('[role="radio"]')
                          [next]?.focus();
                    }
                  }
                : undefined
            }
            style={({ pressed }) => [
              styles.choice,
              compact && styles.compactChoice,
              !compact && star <= value && styles.chosen,
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Icon
              name="star"
              size={28}
              color={star <= value ? colors.star : colors.mutedLight}
              filled={star <= value}
            />
          </Pressable>
        ))}
      </View>
      {!compact && (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.hint, value > 0 && styles.selectedHint]}
        >
          {labels[value] ?? labels[0]}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  compactPicker: { alignItems: "flex-start", gap: 0, paddingVertical: 0 },
  compactChoices: { width: "auto", gap: 4 },
  compactChoice: {
    flex: 0,
    width: 44,
    minHeight: 44,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  stars: { flexDirection: "row", gap: 3, alignItems: "center" },
  fill: { position: "absolute", top: 0, left: 0, overflow: "hidden" },
  picker: { gap: 12, alignItems: "center", paddingVertical: 8 },
  label: {
    fontFamily: fonts.bold,
    ...typography.heading,
    color: colors.ink,
    textAlign: "center",
  },
  choices: {
    flexDirection: "row",
    gap: 6,
    width: "100%",
    maxWidth: 320,
    justifyContent: "center",
  },
  choice: {
    flex: 1,
    minWidth: 44,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceLow,
    borderRadius: appRadius.control,
    borderWidth: 1,
    borderColor: colors.border,
    borderCurve: "continuous",
  },
  chosen: {
    backgroundColor: colors.amberSoft,
    borderColor: colors.primaryMuted,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  hint: {
    fontFamily: fonts.medium,
    ...typography.secondary,
    color: colors.muted,
    textAlign: "center",
  },
  selectedHint: { color: colors.primary },
});
