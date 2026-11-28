import { useState } from "react";
import { Modal, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { SafeAreaView } from "@/components/SafeArea";
import type { useSessionRecordings } from "../hooks/use-session-recordings";
import {
  recordingActions,
  recordingLabels,
} from "../utils/classroom-presentation";
import { classroomStyles as styles } from "./classroom.styles";

export function RecordingControls({
  recordings,
  connected,
  canStart,
  metadataRecording,
}: Readonly<{
  recordings: ReturnType<typeof useSessionRecordings>;
  connected: boolean;
  metadataRecording: boolean;
  canStart: boolean;
}>) {
  const [confirm, setConfirm] = useState(false);
  const active = recordings.data?.find((row) =>
    ["REQUESTED", "STARTING", "RECORDING", "STOPPING"].includes(row.status),
  );
  const actions = active ? recordingActions(active, recordings.userId) : null;
  const disabled =
    !connected ||
    recordings.busy ||
    recordings.isFetching ||
    recordings.isError ||
    !recordings.data ||
    !recordings.active;
  return (
    <View style={styles.card}>
      <View style={styles.spread}>
        <Text style={styles.heading}>Ghi hình buổi học</Text>
        {(metadataRecording || active?.status === "RECORDING") && (
          <Text accessibilityLiveRegion="assertive" style={styles.recording}>
            ● Đang ghi hình
          </Text>
        )}
      </View>
      {!!recordings.message && (
        <FormNotice tone="error">{recordings.message}</FormNotice>
      )}
      {active && (
        <Text style={styles.body} accessibilityLiveRegion="polite">
          {active.status === "REQUESTED"
            ? actions?.answer
              ? "Người cùng học muốn ghi hình buổi này."
              : "Đang chờ người cùng học đồng ý. Yêu cầu có hiệu lực 2 phút."
            : recordingLabels[active.status]}
        </Text>
      )}
      {actions?.answer && active && (
        <>
          <Text style={styles.body}>
            Bản ghi dùng để xem lại bài học và làm bằng chứng nếu có báo cáo.
            Chỉ bắt đầu sau khi bạn đồng ý; cả hai đều có thể dừng ghi.
          </Text>
          <View style={styles.row}>
            <Button
              disabled={disabled}
              onPress={() => {
                void recordings.run("accept", active.id);
              }}
            >
              Đồng ý ghi hình
            </Button>
            <Button
              variant="paper"
              disabled={disabled}
              onPress={() => {
                void recordings.run("decline", active.id);
              }}
            >
              Không đồng ý
            </Button>
          </View>
        </>
      )}
      {actions?.stop && active && (
        <Button
          variant="danger"
          disabled={disabled}
          onPress={() => {
            void recordings.run("stop", active.id);
          }}
        >
          Dừng ghi hình
        </Button>
      )}
      {!active && !metadataRecording && canStart && (
        <>
          <Text style={styles.muted}>
            Cần người cùng học đồng ý. Phút ghi được tính theo gói của người yêu
            cầu.
          </Text>
          <Button
            variant="paper"
            icon="video"
            disabled={disabled}
            onPress={() => setConfirm(true)}
          >
            Yêu cầu ghi hình
          </Button>
        </>
      )}
      {!active && !canStart && (
        <Text style={styles.muted}>
          Có thể yêu cầu ghi hình khi buổi học ở trạng thái sẵn sàng hoặc đang
          diễn ra.
        </Text>
      )}
      {recordings.isError && (
        <Button
          variant="paper"
          disabled={recordings.isFetching}
          onPress={() => {
            void recordings.refetch();
          }}
        >
          Kiểm tra trạng thái ghi hình
        </Button>
      )}
      {confirm && (
        <Modal
          visible
          animationType="slide"
          transparent
          onRequestClose={() => setConfirm(false)}
        >
          <SafeAreaView style={styles.page}>
            <View style={styles.content}>
              <Text style={styles.heading}>Gửi yêu cầu ghi hình?</Text>
              <Text style={styles.body}>
                Bản ghi dùng để xem lại bài học và làm bằng chứng nếu phát sinh
                báo cáo. Cả hai có quyền xem lại và dừng ghi. Ghi hình chỉ bắt
                đầu sau khi người cùng học đồng ý.
              </Text>
              <Text style={styles.body}>
                Hệ thống kiểm tra quyền ghi hình và số phút còn lại trong gói
                của bạn trước khi bắt đầu.
              </Text>
              <Button
                disabled={disabled}
                onPress={() => {
                  setConfirm(false);
                  void recordings.run("request");
                }}
              >
                Gửi yêu cầu
              </Button>
              <Button variant="paper" onPress={() => setConfirm(false)}>
                Để sau
              </Button>
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}
