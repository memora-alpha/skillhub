import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { Room } from "livekit-client";
import { Button } from "@/components/Button";
import { SafeAreaView } from "@/components/SafeArea";
import { FormNotice } from "@/components/FormNotice";
import { useSessionWhiteboard } from "../hooks/use-session-whiteboard";
import { boardReadOnlyText } from "../utils/classroom-presentation";
import { WhiteboardCanvas } from "./whiteboard-canvas";
import { classroomStyles as styles } from "./classroom.styles";

export function SessionWhiteboard({
  sessionId,
  room,
  peerIdentity,
  onClose,
}: Readonly<{
  sessionId: string;
  room?: Room | null;
  peerIdentity?: string;
  onClose: () => void;
}>) {
  const board = useSessionWhiteboard({
    sessionId,
    enabled: true,
    room,
    peerIdentity,
  });
  const [closing, setClosing] = useState(false);
  async function close() {
    if (closing || board.saving) return;
    setClosing(true);
    await board.save();
    setClosing(false);
    if (board.hasUnsavedChanges()) {
      Alert.alert(
        "Đóng bảng trắng?",
        "Vẫn còn nét chưa lưu. Bản nháp được giữ tạm trong phiên này; đóng ứng dụng hoặc đăng xuất sẽ làm mất bản nháp.",
        [
          { text: "Ở lại", style: "cancel" },
          { text: "Đóng, giữ bản nháp", onPress: onClose },
        ],
      );
    } else onClose();
  }
  return (
    <Modal
      visible
      animationType="slide"
      supportedOrientations={["portrait", "landscape"]}
      onRequestClose={() => {
        void close();
      }}
    >
      <SafeAreaView style={styles.page}>
        <View style={styles.header}>
          <View style={styles.spread}>
            <Text style={styles.heading}>Bảng trắng buổi học</Text>
            <Button
              variant="paper"
              size="sm"
              disabled={closing || board.saving}
              onPress={() => {
                void close();
              }}
            >
              Đóng
            </Button>
          </View>
          <Text style={styles.muted} accessibilityLiveRegion="polite">
            {board.saving
              ? "Đang lưu…"
              : board.dirty
                ? "Có thay đổi chưa lưu"
                : board.board
                  ? "Đã đồng bộ với máy chủ"
                  : "Đang mở bảng…"}
          </Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {board.loading && !board.board && (
            <ActivityIndicator accessibilityLabel="Đang tải bảng trắng" />
          )}
          {!!board.error && <FormNotice tone="error">{board.error}</FormNotice>}
          {!!board.error && board.dirty && (
            <Button
              variant="paper"
              disabled={board.loading || board.saving}
              onPress={() =>
                Alert.alert(
                  "Dùng bản trên máy chủ?",
                  "Chỉ bỏ thay đổi chưa lưu trên thiết bị này sau khi tải lại thành công.",
                  [
                    { text: "Giữ bản nháp", style: "cancel" },
                    {
                      text: "Tải bản đã lưu",
                      onPress: () => {
                        void board.useServerSnapshot();
                      },
                    },
                  ],
                )
              }
            >
              Dùng bản đã lưu
            </Button>
          )}
          {board.board && !board.denied && (
            <>
              {!board.canEdit && (
                <FormNotice tone="info">
                  {boardReadOnlyText(board.board.readOnlyReason)}
                </FormNotice>
              )}
              {board.board.retentionDays !== null && (
                <Text style={styles.muted}>
                  Lưu {board.board.retentionDays} ngày sau buổi học.
                </Text>
              )}
              <WhiteboardCanvas
                scene={board.scene}
                editable={board.canEdit}
                onChange={board.change}
              />
            </>
          )}
          <View style={styles.row}>
            <Button
              variant="paper"
              disabled={board.loading || board.saving}
              onPress={() => {
                void board.reload();
              }}
            >
              Kiểm tra cập nhật
            </Button>
            {board.canEdit && board.dirty && (
              <Button
                disabled={board.saving || board.loading}
                onPress={() => {
                  void board.save();
                }}
              >
                Lưu bảng
              </Button>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
