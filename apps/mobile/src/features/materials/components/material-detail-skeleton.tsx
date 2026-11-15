import { StyleSheet, View } from "react-native";
import { appColors, appRadius } from "@/constants/theme";

export function MaterialDetailSkeleton() {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Đang tải chi tiết tài liệu"
      accessibilityState={{ busy: true }}
      style={styles.page}
    >
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={styles.page}
      >
        <View style={styles.hero}>
          <View style={[styles.block, styles.cover]} />
          <View style={styles.info}>
            <View style={[styles.block, styles.title]} />
            <View style={[styles.block, styles.title, styles.medium]} />
            <View style={[styles.block, styles.line, styles.short]} />
            <View style={[styles.block, styles.price]} />
          </View>
        </View>
        <View style={styles.publisher}>
          <View style={[styles.block, styles.avatar]} />
          <View style={styles.info}>
            <View style={[styles.block, styles.line, styles.short]} />
            <View style={[styles.block, styles.line, styles.medium]} />
          </View>
        </View>
        <View style={styles.description}>
          <View style={[styles.block, styles.title, styles.short]} />
          <View style={[styles.block, styles.line]} />
          <View style={[styles.block, styles.line]} />
          <View style={[styles.block, styles.line, styles.medium]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24 },
  block: {
    backgroundColor: appColors.surfaceInset,
    borderRadius: appRadius.control,
  },
  hero: { flexDirection: "row", gap: 16, alignItems: "center" },
  cover: { width: 112, height: 148 },
  info: { flex: 1, minWidth: 0, gap: 12 },
  title: { width: "100%", height: 20 },
  line: { width: "100%", height: 12 },
  medium: { width: "75%" },
  short: { width: "45%" },
  price: { width: 76, height: 26 },
  publisher: { flexDirection: "row", gap: 12, alignItems: "center" },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  description: {
    gap: 14,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: appColors.border,
  },
});
