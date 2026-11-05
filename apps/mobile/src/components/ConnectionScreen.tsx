import { StyleSheet, Text, View } from "react-native";
import { LoadingIndicator } from "./LoadingIndicator";
import { SafeAreaView } from "./SafeArea";
import { BrandLogo } from "./BrandLogo";
import { Button } from "./Button";
import { appColors as colors, fonts, typography } from "@/constants/theme";

export function ConnectionScreen({
  reason,
  retrying = false,
  onRetry,
}: {
  reason?: "offline" | "unreachable" | null;
  retrying?: boolean;
  onRetry?: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.brand}>
        <BrandLogo />
      </View>
      <View style={styles.content}>
        <View style={styles.status}>
          {(!reason || retrying) && (
            <LoadingIndicator
              presentation="inline"
              size="large"
              accessibilityLabel={
                reason ? "Đang kết nối lại" : "Đang tải nội dung"
              }
            />
          )}
          <Text style={styles.label} accessibilityRole="header">
            {!reason
              ? "Đang tải nội dung…"
              : reason === "offline"
                ? "Thiết bị đang ngoại tuyến"
                : "Chưa kết nối được với SkillHub"}
          </Text>
          {reason && (
            <Text style={styles.detail}>
              Kiểm tra kết nối mạng rồi thử lại. App chỉ tải lại dữ liệu; các
              thao tác gửi hoặc thanh toán sẽ không được tự gửi lại.
            </Text>
          )}
          {reason && onRetry && (
            <Button
              onPress={onRetry}
              disabled={retrying}
              accessibilityState={{ busy: retrying }}
            >
              {retrying ? "Đang kết nối lại…" : "Thử kết nối lại"}
            </Button>
          )}
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
  detail: { ...typography.body, color: colors.muted, textAlign: "center" },
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
