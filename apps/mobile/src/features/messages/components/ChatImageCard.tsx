import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { ChatImageViewer } from "./ChatImageViewer";
import { appRadius, fonts, typography } from "@/constants/theme";
import { messageColors as colors } from "../constants/theme";

export function ChatImageCard({
  filename,
  uri,
  error,
  onError,
  onRetry,
  onDownload,
  downloadError,
  pending = false,
  previewUri,
  previewError,
  onPreviewError,
  onPreviewRetry,
  onOpenChange,
  status,
  loading = false,
}: Readonly<{
  filename: string;
  uri?: string;
  error?: string;
  onError?: () => void;
  onRetry?: () => void;
  onDownload?: () => void;
  downloadError?: string;
  pending?: boolean;
  previewUri?: string;
  previewError?: string;
  onPreviewError?: () => void;
  onPreviewRetry?: () => void;
  onOpenChange?: (open: boolean) => void;
  status?: "pending" | "review" | "unavailable";
  loading?: boolean;
}>) {
  const [open, setOpen] = useState(false);
  const [failedUri, setFailedUri] = useState<string>();
  const readable = !status && !error && uri && failedUri !== uri;
  const viewerUri = onOpenChange ? previewUri : uri;
  const changeOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };
  const imageFailed = () => {
    setFailedUri(uri);
    onError?.();
  };
  return (
    <View style={styles.card}>
      {readable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Xem ảnh ${filename}`}
          onPress={() => changeOpen(true)}
        >
          <Image
            source={{ uri }}
            contentFit="cover"
            cachePolicy="none"
            accessibilityLabel={filename}
            onError={imageFailed}
            style={styles.image}
          />
        </Pressable>
      ) : (
        <View style={styles.placeholder}>
          <Icon name="image" size={28} color={colors.muted} />
          <Text accessibilityLiveRegion="polite" style={styles.copy}>
            {status === "unavailable"
              ? "Ảnh không còn khả dụng."
              : status === "review"
                ? "Ảnh cần kiểm tra thêm."
                : status === "pending"
                  ? "Đang tải lên…"
                  : (error ??
                    (failedUri
                      ? "Không đọc được ảnh."
                      : loading
                        ? "Đang tải ảnh…"
                        : "Ảnh không còn khả dụng."))}
          </Text>
          {!status && !!error && onRetry && (
            <Button
              variant="ghost"
              onPress={() => {
                setFailedUri(undefined);
                onRetry();
              }}
            >
              Thử tải lại ảnh
            </Button>
          )}
        </View>
      )}
      {readable && open && (
        <ChatImageViewer
          filename={filename}
          uri={viewerUri}
          error={previewError}
          pending={pending}
          downloadError={downloadError}
          onClose={() => changeOpen(false)}
          onDownload={onDownload}
          onError={onPreviewError ?? imageFailed}
          onRetry={onPreviewRetry}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 240,
    maxWidth: "100%",
    overflow: "hidden",
    borderRadius: appRadius.control,
  },
  image: { width: "100%", aspectRatio: 4 / 3 },
  placeholder: {
    width: "100%",
    aspectRatio: 4 / 3,
    padding: 12,
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.tag,
  },
  copy: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.inkSoft,
    textAlign: "center",
  },
});
