import { Pressable, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { RoomPreview } from "./room-preview";
import { RoomAction } from "./room-action";
import { RoomHeading } from "./room-heading";
import { roomStyles as styles } from "./native-room.styles";

export function RoomLobby({
  partnerName,
  camera,
  microphone,
  onCameraChange,
  onMicrophoneChange,
  previewAvailable,
  reason,
  canJoin,
  refreshing,
  onJoin,
  onRefresh,
}: Readonly<{
  partnerName: string;
  camera: boolean;
  microphone: boolean;
  onCameraChange: (value: boolean) => void;
  onMicrophoneChange: (value: boolean) => void;
  previewAvailable: boolean;
  reason: string;
  canJoin: boolean;
  refreshing: boolean;
  onJoin: () => void;
  onRefresh: () => void;
}>) {
  return (
    <View style={styles.page}>
      <RoomHeading
        subtitle={"Học cùng " + partnerName}
        status="Chưa vào phòng"
        action={
          <RoomAction
            icon="refresh"
            label="Kiểm tra trạng thái phòng"
            disabled={refreshing}
            onPress={onRefresh}
          />
        }
      />
      {camera && previewAvailable ? (
        <RoomPreview onUnavailable={() => onCameraChange(false)} />
      ) : (
        <View style={styles.tile}>
          <View style={styles.placeholder}>
            <Avatar name="Bạn" size={72} />
            <Text style={styles.placeholderText}>Camera đang tắt</Text>
            <Text style={styles.subtitle}>
              Bật camera để xem trước hình ảnh của bạn
            </Text>
          </View>
          <View style={styles.tileLabel}>
            <Text style={styles.name}>Bạn · Xem trước</Text>
          </View>
        </View>
      )}
      <View style={styles.controlRow}>
        <RoomAction
          icon={microphone ? "microphone" : "microphone-off"}
          label={
            microphone ? "Tắt micro khi vào phòng" : "Bật micro khi vào phòng"
          }
          tone={microphone ? undefined : "off"}
          selected={microphone}
          disabled={!previewAvailable || refreshing}
          onPress={() => onMicrophoneChange(!microphone)}
        />
        <RoomAction
          icon={camera ? "video" : "video-off"}
          label={camera ? "Tắt camera" : "Bật camera xem trước"}
          tone={camera ? undefined : "off"}
          selected={camera}
          disabled={!previewAvailable || refreshing}
          onPress={() => onCameraChange(!camera)}
        />
      </View>
      <View style={styles.lobbyInfo}>
        <Text accessibilityRole="header" style={styles.lobbyTitle}>
          Sẵn sàng học cùng nhau?
        </Text>
        <Text style={styles.body}>
          Kiểm tra camera và chọn bật micro khi vào phòng.
        </Text>
        <Text selectable accessibilityLiveRegion="polite" style={styles.body}>
          {reason}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bắt đầu học"
          accessibilityState={{ disabled: !canJoin }}
          disabled={!canJoin}
          onPress={onJoin}
          style={({ pressed }) => [
            styles.startButton,
            (!canJoin || pressed) && { opacity: !canJoin ? 0.4 : 0.8 },
          ]}
        >
          <Text style={styles.startLabel}>Bắt đầu học</Text>
        </Pressable>
        <Text style={styles.footnote}>
          Bạn có thể vào phòng với camera và micro tắt. Hình ảnh, âm thanh chỉ
          được chia sẻ sau khi bấm “Bắt đầu học”. Chat trong phòng không lưu
          lịch sử. Rời phòng không xác nhận hoàn tất buổi học.
        </Text>
      </View>
    </View>
  );
}
