import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { Icon } from "@/components/Icon";
import { SafeAreaView } from "@/components/SafeArea";
import { fonts, typography } from "@/constants/theme";
import { messageColors as colors } from "../constants/theme";

export const chatViewerBackground = "#000000";
const toolbarTop = 28;
const toolbarBottom = 12;
const actionSize = 44;
export const chatViewerToolbarHeight = toolbarTop + actionSize + toolbarBottom;

export type ChatImageViewerProps = Readonly<{
  filename: string;
  uri?: string;
  error?: string;
  pending?: boolean;
  downloadError?: string;
  onClose(): void;
  onDownload?: () => void;
  onError?: () => void;
  onRetry?: () => void;
}>;

export function ChatViewerToolbar({
  onClose,
  onDownload,
  pending,
  safeAreaPadding,
  downloadError,
}: ChatImageViewerProps & { safeAreaPadding?: ViewStyle }) {
  return (
    <SafeAreaView
      edges={safeAreaPadding ? [] : ["top", "left", "right"]}
      style={safeAreaPadding}
      pointerEvents="box-none"
    >
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đóng ảnh"
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Icon name="close" size={24} color={colors.white} />
        </Pressable>
        {onDownload && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pending ? "Đang tải ảnh…" : "Tải ảnh"}
            accessibilityState={{ disabled: !!pending, busy: !!pending }}
            hitSlop={8}
            disabled={pending}
            onPress={() => {
              if (!pending) onDownload();
            }}
            style={({ pressed }) => [
              styles.action,
              pressed && styles.pressed,
              pending && styles.disabled,
            ]}
          >
            {pending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Icon name="download" size={23} color={colors.white} />
            )}
          </Pressable>
        )}
      </View>
      {!!downloadError && !pending && (
        <View style={styles.downloadFeedback}>
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={styles.downloadError}
          >
            {downloadError}
          </Text>
          {onDownload && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thử tải xuống lại ảnh"
              onPress={onDownload}
              style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
            >
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

export function ChatImageFeedback(props: ChatImageViewerProps) {
  return (
    <View style={styles.placeholder}>
      <Text accessibilityLiveRegion="polite" style={styles.copy}>
        {props.error ?? "Đang tải ảnh…"}
      </Text>
      {!!props.error && props.onRetry && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thử tải lại ảnh"
          onPress={props.onRetry}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>Thử tải lại ảnh</Text>
        </Pressable>
      )}
    </View>
  );
}

export function ChatImageViewerBase(props: ChatImageViewerProps) {
  return (
    <Modal
      visible
      transparent={false}
      animationType="none"
      onRequestClose={props.onClose}
      statusBarTranslucent
      hardwareAccelerated
    >
      <View style={styles.viewer}>
        {props.uri ? (
          <Image
            source={{ uri: props.uri }}
            contentFit="contain"
            cachePolicy="none"
            accessibilityLabel={props.filename}
            onError={props.onError}
            style={styles.image}
          />
        ) : (
          <ChatImageFeedback {...props} />
        )}
        <View pointerEvents="box-none" style={styles.header}>
          <ChatViewerToolbar {...props} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewer: { flex: 1, backgroundColor: chatViewerBackground },
  header: { position: "absolute", top: 0, left: 0, right: 0 },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: toolbarTop,
    paddingBottom: toolbarBottom,
  },
  action: {
    width: actionSize,
    height: actionSize,
    borderRadius: actionSize / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(48, 48, 48, 0.85)",
  },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.6 },
  downloadFeedback: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    alignItems: "center",
  },
  downloadError: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.white,
    textAlign: "center",
  },
  retry: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#303030",
  },
  retryText: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.white,
  },
  image: { flex: 1, width: "100%" },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
    gap: 8,
  },
  copy: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.white,
    textAlign: "center",
  },
});
