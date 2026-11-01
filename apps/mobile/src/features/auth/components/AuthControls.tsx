import { StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { typography, colors, fonts } from "@/constants/theme";
import { passwordRequirements } from "../utils/password-requirements";

export function PasswordRequirements({ password }: { password: string }) {
  return (
    <View style={styles.requirements}>
      {passwordRequirements(password).map((rule) => (
        <View key={rule.label} style={styles.rule}>
          <View
            style={[
              styles.dot,
              { backgroundColor: rule.met ? colors.success : colors.border },
            ]}
          >
            {rule.met && <Icon name="check" size={8} color={colors.white} />}
          </View>
          <Text
            style={[
              styles.ruleLabel,
              { color: rule.met ? colors.success : colors.muted },
            ]}
          >
            {rule.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
export const authStyles = StyleSheet.create({
  fields: { gap: 12 },
  link: {
    color: colors.brand,
    fontFamily: fonts.semibold,
    ...typography.body,
    includeFontPadding: false,
  },
  footer: {
    paddingTop: 8,
    color: colors.muted,
    fontFamily: fonts.body,
    ...typography.body,
    textAlign: "center",
    includeFontPadding: false,
  },
});
const styles = StyleSheet.create({
  requirements: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  rule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 140,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  ruleLabel: {
    flexShrink: 1,
    fontFamily: fonts.body,
    ...typography.secondary,
    includeFontPadding: false,
  },
});
