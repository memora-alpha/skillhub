import { Pressable, StyleSheet, Text, View } from "react-native";
import { LoadingIndicator as ActivityIndicator } from "@/components/LoadingIndicator";
import { Image } from "expo-image";
import { appColors as colors } from "@/constants/theme";
import type { Evidence } from "../types/skills";
import { useEvidenceImage } from "../hooks/use-evidence-image";
import { formatFileSize } from "../utils/format-file-size";
import { skillStyles } from "./SkillsLayout";
import { SkillAction } from "./SkillAction";

export function SubmittedEvidence({
  id,
  file,
  index,
  compact = false,
}: Readonly<{
  id: string;
  file: Evidence;
  index: number;
  compact?: boolean;
}>) {
  const image = file.mimeType.startsWith("image/");
  const title = file.title || `${image ? "Ảnh" : "Tài liệu"} ${index + 1}`;
  let format = image ? "Ảnh" : "Word";
  if (!image && file.mimeType === "application/pdf") format = "PDF";
  return (
    <View style={compact ? styles.compactRow : { gap: 8 }}>
      {image && (
        <SubmittedImage
          id={id}
          evidenceId={file.id}
          title={title}
          compact={compact}
        />
      )}
      <View style={compact ? styles.compactMetadata : skillStyles.row}>
        <Text
          numberOfLines={compact ? 2 : undefined}
          style={[
            compact ? skillStyles.caption : skillStyles.body,
            { flexShrink: 1, color: colors.ink },
          ]}
        >
          {title}
        </Text>
        <Text style={skillStyles.caption}>
          {format} · {formatFileSize(Number(file.fileSizeBytes))}
        </Text>
      </View>
    </View>
  );
}

function SubmittedImage({
  id,
  evidenceId,
  title,
  compact,
}: Readonly<{
  id: string;
  evidenceId: string;
  title: string;
  compact: boolean;
}>) {
  const image = useEvidenceImage(id, evidenceId);
  return (
    <View style={[styles.preview, compact && styles.thumbnail]}>
      {image.uri ? (
        <Image
          source={{ uri: image.uri }}
          style={{
            width: "100%",
            aspectRatio: compact ? 1 : 4 / 3,
            maxHeight: compact ? 72 : 240,
          }}
          contentFit="contain"
          cachePolicy="none"
          accessible
          accessibilityLabel={`Bằng chứng đã gửi: ${title}`}
          onError={image.failed}
        />
      ) : (
        <View
          style={[styles.placeholder, compact && styles.compactPlaceholder]}
        >
          <SubmittedImageFallback
            loading={image.loading}
            compact={compact}
            onRetry={image.retry}
          />
        </View>
      )}
    </View>
  );
}
function SubmittedImageFallback({
  loading,
  compact,
  onRetry,
}: Readonly<{
  loading: boolean;
  compact: boolean;
  onRetry: () => void;
}>) {
  if (loading)
    return <ActivityIndicator accessibilityLabel="Đang tải ảnh bằng chứng" />;
  if (compact)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tải lại ảnh"
        accessibilityHint="Ảnh chưa tải được. Thử lấy ảnh lại."
        onPress={onRetry}
        style={({ pressed }) => ({
          minHeight: 44,
          justifyContent: "center",
          opacity: pressed ? 0.55 : 1,
        })}
      >
        <Text style={[skillStyles.caption, { color: colors.primary }]}>
          Tải lại ảnh
        </Text>
      </Pressable>
    );
  return (
    <>
      <Text style={skillStyles.caption}>Chưa tải được ảnh.</Text>
      <SkillAction label="Tải lại ảnh" icon="image" onPress={onRetry} />
    </>
  );
}
const styles = StyleSheet.create({
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  compactMetadata: { flex: 1, gap: 3 },
  thumbnail: { width: 72, flexShrink: 0 },
  compactPlaceholder: { minHeight: 72, padding: 4 },
  preview: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surfaceLow,
  },
  placeholder: {
    minHeight: 100,
    padding: 16,
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
