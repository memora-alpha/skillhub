import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Icon } from "@/components/Icon";
import { colors, fonts } from "@/constants/theme";
import { passwordRequirements } from "../utils/validateRegistration";

export function GoogleButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.google, pressed && { opacity: 0.7 }]}
    >
      <Svg width={18} height={18} viewBox="0 0 18 18">
        <Path
          d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
          fill="#4285F4"
        />
        <Path
          d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.26c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
          fill="#34A853"
        />
        <Path
          d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
          fill="#FBBC05"
        />
        <Path
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
          fill="#EA4335"
        />
      </Svg>
      <Text style={styles.googleLabel}>{label}</Text>
    </Pressable>
  );
}
export function AuthDivider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.line} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}
export function PasswordRequirements({ password }: { password: string }) {
  if (!password) return null;
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
  fields: { gap: 16 },
  link: {
    color: colors.brand,
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  footer: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    includeFontPadding: false,
  },
  hint: {
    color: colors.mutedLight,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    includeFontPadding: false,
  },
});
const styles = StyleSheet.create({
  google: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 12,
  },
  googleLabel: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    includeFontPadding: false,
  },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.mutedLight,
    includeFontPadding: false,
  },
  requirements: { gap: 4, marginTop: 4 },
  rule: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  ruleLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
  },
});
