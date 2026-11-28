import { useState } from "react";
import { ActivityIndicator, Modal, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { SafeAreaView } from "@/components/SafeArea";
import { useSessionRecordings } from "../hooks/use-session-recordings";
import {
  recordingActions,
  recordingLabels,
} from "../utils/classroom-presentation";
import { RecordingViewer } from "./recording-viewer";
import { classroomStyles as styles } from "./classroom.styles";

export function SessionRecordings({
  sessionId,
}: Readonly<{ sessionId: string }>) {
  const query = useSessionRecordings(sessionId);
  const [playing, setPlaying] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const disabled =
    query.busy || query.isFetching || query.isError || !query.active;
  return (
    <View style={styles.stack}>
      {query.isLoading && (
        <ActivityIndicator accessibilityLabel="Đang tải bản ghi buổi học" />
      )}
      {!!query.message && <FormNotice tone="error">{query.message}</FormNotice>}
      {query.isError && (
        <Button
          variant="paper"
          disabled={query.isFetching}
          onPress={() => {
            void query.refetch();
          }}
        >
          Thử tải lại bản ghi
        </Button>
      )}
      {query.data?.length === 0 && (
        <Text style={styles.body}>
          Chưa có bản ghi. Bạn có thể yêu cầu ghi hình khi đang trong phòng học.
        </Text>
      )}
      {query.data?.map((row) => {
        const actions = recordingActions(row, query.userId);
        return (
          <View key={row.id} style={styles.card}>
            <Text style={styles.heading}>{recordingLabels[row.status]}</Text>
            <Text style={styles.muted}>
              {new Date(row.requestedAt).toLocaleString("vi-VN")}
              {row.durationMs !== null
                ? ` · ${Math.ceil(row.durationMs / 60_000)} phút`
                : ""}
            </Text>
            {row.expiresAt && (
              <Text style={styles.muted}>
                Hạn xem: {new Date(row.expiresAt).toLocaleString("vi-VN")}
              </Text>
            )}
            {row.retentionDays !== null && (
              <Text style={styles.muted}>
                Thời hạn lưu: {row.retentionDays} ngày
              </Text>
            )}
            {row.heldByReport && (
              <FormNotice tone="info">
                Đang giữ bản ghi làm bằng chứng. Bạn chưa thể xóa trong lúc báo
                cáo được xử lý.
              </FormNotice>
            )}
            <View style={styles.row}>
              {actions.play && (
                <Button
                  size="sm"
                  icon="video"
                  disabled={disabled}
                  onPress={() => setPlaying(row.id)}
                >
                  Xem lại
                </Button>
              )}
              {actions.delete && (
                <Button
                  size="sm"
                  variant="danger"
                  disabled={disabled}
                  onPress={() => setDeleting(row.id)}
                >
                  Xóa bản ghi
                </Button>
              )}
            </View>
          </View>
        );
      })}
      {playing &&
        query.data?.some(
          (row) =>
            row.id === playing && recordingActions(row, query.userId).play,
        ) && (
          <RecordingViewer
            key={playing}
            sessionId={sessionId}
            recordingId={playing}
            onClose={() => setPlaying(null)}
          />
        )}
      {deleting && (
        <Modal
          visible
          animationType="slide"
          onRequestClose={() => {
            if (!query.busy) setDeleting(null);
          }}
        >
          <SafeAreaView style={styles.page}>
            <View style={styles.content}>
              <Text style={styles.heading}>Xóa bản ghi cho cả hai người?</Text>
              <Text style={styles.body}>
                Bản ghi sẽ bị xóa khỏi buổi học và không thể khôi phục. Nội dung
                đang được giữ làm bằng chứng sẽ không được phép xóa.
              </Text>
              <Button
                variant="danger"
                disabled={disabled}
                onPress={() => {
                  void query
                    .run("delete", deleting)
                    .then(() => setDeleting(null));
                }}
              >
                {query.busy ? "Đang xóa…" : "Xác nhận xóa"}
              </Button>
              <Button
                variant="paper"
                disabled={query.busy}
                onPress={() => setDeleting(null)}
              >
                Giữ bản ghi
              </Button>
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}
