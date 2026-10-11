import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "./Button";
import { BrandLogo } from "./BrandLogo";
import { Icon } from "./Icon";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import type { ConnectionState } from "@/lib/network/connection-store";

export function ConnectionScreen({
  reason,
  retrying,
  onRetry,
}: ConnectionState & { onRetry: () => void }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.brand}>
        <BrandLogo />
      </View>
      <View style={styles.center}>
        <View style={styles.illustration}>
          {retrying ? (
            <ActivityIndicator
              color={colors.forest}
              size="large"
              accessibilityLabel="Đang kết nối lại"
            />
          ) : (
            <Icon name="wifi-off" size={44} color={colors.forest} />
          )}
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {retrying
            ? "Đang kết nối lại…"
            : reason === "offline"
              ? "Bạn đang ngoại tuyến"
              : "Kết nối bị gián đoạn"}
        </Text>
        <Text style={styles.body}>
          {retrying
            ? "Chờ một chút, SkillHub đang tải lại dữ liệu."
            : reason === "offline"
              ? "Kiểm tra Wi-Fi hoặc dữ liệu di động rồi thử lại."
              : "Chưa thể kết nối tới SkillHub. Vui lòng thử lại."}
        </Text>
        <Button disabled={retrying} onPress={onRetry} style={styles.button}>
          {retrying ? "Đang tải lại…" : "Thử lại"}
        </Button>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, padding: 24 },
  brand: { alignSelf: "flex-start", paddingTop: 12 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    paddingBottom: 64,
  },
  illustration: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.forestSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    ...typography.title,
    fontFamily: fonts.bold,
    color: colors.ink,
    textAlign: "center",
  },
  body: {
    ...typography.body,
    fontFamily: fonts.body,
    color: colors.muted,
    textAlign: "center",
  },
  button: { minWidth: 160, minHeight: 48, borderRadius: 14, marginTop: 8 },
});
