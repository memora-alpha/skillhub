import { StyleSheet, Text, View } from "react-native";
import { LoadingIndicator } from "./LoadingIndicator";
import { SafeAreaView } from "./SafeArea";
import { BrandLogo } from "./BrandLogo";
import { appColors as colors, fonts, typography } from "@/constants/theme";

export function ConnectionScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.brand}>
        <BrandLogo />
      </View>
      <View style={styles.content}>
        <View style={styles.status}>
          <LoadingIndicator
            size="large"
            accessibilityLabel="Đang tải nội dung"
          />
          <Text style={styles.label}>Đang tải nội dung…</Text>
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          style={styles.placeholders}
        >
          {[0, 1, 2].map((item) => (
            <View key={item} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.avatar} />
                <View style={styles.lines}>
                  <View style={[styles.line, styles.short]} />
                  <View style={[styles.line, styles.medium]} />
                </View>
              </View>
              <View style={styles.line} />
              <View style={[styles.line, styles.medium]} />
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, padding: 24 },
  brand: { alignSelf: "flex-start", paddingTop: 12 },
  content: {
    flex: 1,
    justifyContent: "center",
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    paddingVertical: 24,
    gap: 32,
  },
  status: { alignItems: "center", gap: 12 },
  label: { ...typography.body, fontFamily: fonts.medium, color: colors.muted },
  placeholders: { gap: 16, flexShrink: 1, overflow: "hidden" },
  card: {
    borderRadius: 20,
    padding: 20,
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceInset,
  },
  lines: { flex: 1, gap: 8 },
  line: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceInset },
  short: { width: "45%" },
  medium: { width: "70%" },
});
