import { StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import type { ApiMaterial } from "../api/material-contracts";
import { materialFileType } from "../utils/owner-material-presentation";
import { materialThumbnailUrl } from "../utils/material-thumbnail";

function coverFormat(format: string) {
  const labels: Readonly<Record<string, string>> = {
    PowerPoint: "PPT",
    Word: "DOC",
    Excel: "XLS",
    "Văn bản": "TXT",
    Ảnh: "ẢNH",
    PDF: "PDF",
  };
  return labels[format] ?? "TỆP";
}

function coverTone(format: string) {
  if (format === "Word")
    return { background: colors.infoSoft, ink: colors.info };
  if (format === "Excel")
    return { background: colors.forestSoft, ink: colors.forest };
  return { background: colors.primarySoft, ink: colors.primary };
}

// A format cover, not a page preview: never issue a download to create artwork.
export function MaterialCover({
  material,
  large = false,
  compact = false,
}: Readonly<{ material: ApiMaterial; large?: boolean; compact?: boolean }>) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const [now, setNow] = useState(Date.now);
  const thumbnail = material.cover?.preview ?? material.thumbnail;
  const expiresAt =
    thumbnail?.kind === "GENERATED" ? thumbnail.expiresAt : undefined;
  useEffect(() => {
    if (!expiresAt) return;
    const delay = Date.parse(expiresAt) - Date.now();
    if (delay <= 0) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(delay, 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [expiresAt]);
  const uri = materialThumbnailUrl(material, large, Math.max(now, Date.now()));
  if (uri && uri !== failedUrl)
    return (
      <Image
        source={{ uri }}
        style={[styles.cover, compact && styles.compact, large && styles.large]}
        contentFit="cover"
        cachePolicy="none"
        recyclingKey={uri}
        accessibilityLabel={`Ảnh bìa ${material.title}`}
        onError={() => setFailedUrl(uri)}
      />
    );
  const format = materialFileType(material);
  const label = coverFormat(format);
  const tone = coverTone(format);
  const regularIconSize = compact ? 18 : 24;
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.cover,
        compact && styles.compact,
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
          size={large ? 30 : regularIconSize}
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
  compact: { width: 64, height: 84, padding: 6, paddingLeft: 10 },
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
