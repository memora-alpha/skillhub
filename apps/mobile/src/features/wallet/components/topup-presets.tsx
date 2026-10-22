import { Pressable, StyleSheet, Text, View } from "react-native";
import { appRadius, fonts, typography } from "@/constants/theme";
import { paymentPalette as colors } from "./wallet-payment-palette";
import { formatVnd } from "../utils/amount";

export function TopupPresets({
  value,
  disabled,
  onSelect,
}: {
  value: string;
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {["20000", "50000", "100000", "200000", "500000", "1000000"].map(
        (amount) => (
          <Pressable
            key={amount}
            accessibilityRole="button"
            accessibilityLabel={`Chọn ${formatVnd(amount)}`}
            accessibilityState={{ selected: value === amount, disabled }}
            disabled={disabled}
            onPress={() => onSelect(amount)}
            style={({ pressed }) => [
              styles.item,
              value === amount && styles.selected,
              pressed && { opacity: 0.75 },
              disabled && { opacity: 0.5 },
            ]}
          >
            <Text
              style={[styles.text, value === amount && styles.selectedText]}
            >
              {formatVnd(amount).replace(" VND", " đ")}
            </Text>
          </Pressable>
        ),
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  item: {
    paddingHorizontal: 4,
    paddingVertical: 10,
    borderRadius: appRadius.control,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    width: "31%",
    minWidth: 0,
    backgroundColor: colors.surfaceInset,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: {
    borderColor: colors.brand,
    borderWidth: 2,
    backgroundColor: colors.brandWash,
  },
  text: {
    fontFamily: fonts.semibold,
    ...typography.secondary,
    color: colors.body,
  },
  selectedText: { color: colors.brandDark },
});
