import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "@/components/SafeArea";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { ChoiceGroup } from "@/components/choice-group";
import { appColors as colors, appRadius, fonts } from "@/constants/theme";
import { audioOutputLabels } from "../utils/native-audio-settings";
import type { useNativeMediaSettings } from "../hooks/use-native-media-settings";
import type { useNativeCameraBackground } from "../hooks/use-native-camera-background";
import {
  nativeBackgroundChoices,
  nativeBackgroundLabel,
} from "../utils/native-background";

export function NativeMediaSettings({
  media,
  background,
  disabled,
  camera,
  facing,
  onCamera,
  onClose,
}: Readonly<{
  media: ReturnType<typeof useNativeMediaSettings>;
  background: ReturnType<typeof useNativeCameraBackground>;
  disabled: boolean;
  camera: boolean;
  facing: "user" | "environment";
  onCamera: () => void;
  onClose: () => void;
}>) {
  const busy = disabled || media.pending || background.busy;
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}
      supportedOrientations={["portrait", "landscape"]}
    >
      <SafeAreaView style={styles.page}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Âm thanh và hình ảnh
          </Text>
          <Button variant="secondary" size="sm" onPress={onClose}>
            Đóng
          </Button>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {!!media.error && <FormNotice tone="error">{media.error}</FormNotice>}
          {!!background.error && (
            <FormNotice tone="error">{background.error}</FormNotice>
          )}
          <View style={styles.panel}>
            <Text style={styles.title}>Micro</Text>
            {(
              [
                ["echoCancellation", "Khử tiếng vọng"],
                ["noiseSuppression", "Lọc tiếng ồn cơ bản"],
                ["autoGainControl", "Tự điều chỉnh mức thu mic"],
              ] as const
            ).map(([key, label]) => (
              <View key={key} style={styles.row}>
                <Text style={styles.label}>{label}</Text>
                <Switch
                  accessibilityLabel={label}
                  value={media.settings[key]}
                  disabled={busy}
                  onValueChange={(value) =>
                    void media.change({ ...media.settings, [key]: value })
                  }
                />
              </View>
            ))}
            {media.manualGain && (
              <ChoiceGroup
                label="Mức thu mic"
                options={["50%", "100%", "150%", "200%"]}
                value={`${Math.round(media.settings.microphoneGain * 100)}%`}
                disabled={busy || media.settings.autoGainControl}
                onChange={(value) =>
                  void media.change({
                    ...media.settings,
                    microphoneGain: Number.parseInt(value, 10) / 100,
                  })
                }
              />
            )}
            <Text style={styles.copy}>
              {media.manualGain
                ? "Tắt tự điều chỉnh để chọn mức thu mic."
                : "Mức thu mic được thiết bị quản lý. Bật tự điều chỉnh để cân bằng giọng nói."}
            </Text>
            <Text style={styles.copy}>
              Đổi bộ lọc không tự bật micro đang tắt.
            </Text>
          </View>
          <View style={styles.panel}>
            <Text style={styles.title}>Âm thanh đối tác</Text>
            <ChoiceGroup
              label="Âm lượng nghe"
              options={["0%", "25%", "50%", "75%", "100%"]}
              value={`${Math.round(media.volume * 100)}%`}
              disabled={busy}
              onChange={(value) =>
                void media.changeVolume(Number.parseInt(value, 10) / 100)
              }
            />
            {media.outputs.length > 0 && (
              <View style={styles.outputs}>
                <Text style={styles.label}>Thiết bị phát</Text>
                {media.outputs.map((output) => (
                  <Button
                    key={output}
                    variant={media.output === output ? "primary" : "secondary"}
                    disabled={busy}
                    onPress={() => void media.changeOutput(output)}
                  >
                    {audioOutputLabels[output] ?? output}
                  </Button>
                ))}
              </View>
            )}
          </View>
          <View style={styles.panel}>
            <Text style={styles.title}>Hình ảnh</Text>
            <Text style={styles.copy}>
              {camera
                ? `Đang dùng camera ${facing === "user" ? "trước" : "sau"}.`
                : "Camera đang tắt."}
            </Text>
            <Button
              variant="secondary"
              disabled={busy || !camera}
              onPress={onCamera}
            >
              Đổi camera trước / sau
            </Button>
            {background.available ? (
              <>
                <ChoiceGroup
                  label="Nền camera"
                  options={Object.keys(nativeBackgroundChoices)}
                  value={nativeBackgroundLabel(background.settings)}
                  disabled={busy}
                  onChange={(label) => {
                    const next = nativeBackgroundChoices[label];
                    if (next) void background.change(next);
                  }}
                />
                <Text style={styles.copy} accessibilityLiveRegion="polite">
                  {background.warming
                    ? "Đang khởi động hiệu ứng nền…"
                    : "Hiệu ứng được xử lý trên máy và gửi cùng video cho đối tác. Chọn nền không tự bật camera đang tắt."}
                </Text>
              </>
            ) : (
              <Text style={styles.copy}>
                Hiệu ứng nền chưa có trong bản cài đặt này. Hãy cập nhật bản
                Android mới hoặc dùng phòng học trên web.
              </Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  header: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontFamily: fonts.bold,
    color: colors.body,
    fontSize: 18,
    flexShrink: 1,
  },
  content: { padding: 16, gap: 16 },
  panel: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.card,
    gap: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: { fontFamily: fonts.semibold, color: colors.body, flexShrink: 1 },
  copy: { fontFamily: fonts.body, color: colors.muted, lineHeight: 22 },
  outputs: { gap: 8 },
});
