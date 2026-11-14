import { StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import type { ApiMaterial } from "../api/material-contracts";
import { materialFileType } from "../utils/owner-material-presentation";

// A format cover, not a page preview: never issue a download to create artwork.
export function MaterialCover({
  material,
  large = false,
}: Readonly<{ material: ApiMaterial; large?: boolean }>) {
  const format = materialFileType(material);
  const label =
    format === "PowerPoint"
      ? "PPT"
      : format === "Word"
        ? "DOC"
        : format === "Excel"
          ? "XLS"
          : format === "Văn bản"
            ? "TXT"
            : format === "Ảnh"
              ? "ẢNH"
              : format === "PDF"
                ? "PDF"
                : "TỆP";
  const tone =
    format === "Word"
      ? { background: colors.infoSoft, ink: colors.info }
      : format === "Excel"
        ? { background: colors.forestSoft, ink: colors.forest }
        : { background: colors.primarySoft, ink: colors.primary };
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.cover,
        large && styles.large,
        { backgroundColor: tone.background },
      ]}
    >
      <View style={[styles.spine, { backgroundColor: tone.ink }]} />
      <View style={styles.sheet}>
        <View style={[styles.format, { backgroundColor: tone.background }]}>
          <Text
            numberOfLines={1}
            style={[styles.formatText, { color: tone.ink }]}
          >
            {label}
          </Text>
        </View>
        <Icon
          name={material.file?.mimeType.startsWith("image/") ? "image" : "file"}
          size={large ? 30 : 24}
          color={tone.ink}
        />
        <View style={styles.lines}>
          <View style={[styles.line, { backgroundColor: tone.ink }]} />
          <View
            style={[styles.line, styles.short, { backgroundColor: tone.ink }]}
          />
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  cover: {
    width: 88,
    height: 116,
    flexShrink: 0,
    borderRadius: appRadius.control,
    overflow: "hidden",
    padding: 10,
    paddingLeft: 14,
    justifyContent: "center",
  },
  large: { width: 112, height: 148, padding: 14, paddingLeft: 18 },
  spine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    opacity: 0.4,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 6,
    padding: 8,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 4,
  },
  format: {
    maxWidth: "100%",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  formatText: { fontFamily: fonts.bold, ...typography.caption },
  lines: { gap: 4, width: "100%" },
  line: { height: 3, borderRadius: 2, opacity: 0.2, width: "100%" },
  short: { width: "65%" },
});
