import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ActivityIndicator, Modal, Text, View } from "react-native";
import { SafeAreaView } from "@/components/SafeArea";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { useSessionsRuntime } from "../runtime";
import { useClassroomActivity } from "../hooks/use-classroom-activity";
import { classroomError } from "../utils/classroom-presentation";
import type { RecordingPlayback } from "../api/classroom-contracts";
import { classroomStyles as styles } from "./classroom.styles";

const Video = lazy(() => import("./recording-video"));
class PlayerBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <FormNotice tone="info">
          Bản cài đặt này chưa hỗ trợ phát video. Hãy cập nhật bản ứng dụng có
          trình phát ghi hình.
        </FormNotice>
      );
    return this.props.children;
  }
}
export function RecordingViewer({
  sessionId,
  recordingId,
  onClose,
}: Readonly<{
  sessionId: string;
  recordingId: string;
  onClose: () => void;
}>) {
  const runtime = useSessionsRuntime(),
    active = useClassroomActivity(runtime.enabled);
  const [source, setSource] = useState<RecordingPlayback | null>(null);
  const position = useRef(0);
  const progress = useCallback((seconds: number) => {
    if (Number.isFinite(seconds)) position.current = seconds;
  }, []);
  const [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const failed = useCallback(
    () =>
      setError("Không phát được bản ghi. Hãy lấy liên kết xem mới và thử lại."),
    [],
  );
  useEffect(() => {
    if (!active) {
      setSource(null);
      return;
    }
    let current = true;
    setSource(null);
    setError("");
    void runtime.api
      .recordingPlayback(sessionId, recordingId)
      .then((value) => {
        if (current && runtime.isCurrent()) setSource(value);
      })
      .catch((cause) => {
        if (current && runtime.isCurrent()) setError(classroomError(cause));
      });
    return () => {
      current = false;
    };
  }, [runtime.api, runtime.isCurrent, sessionId, recordingId, active, attempt]);
  useEffect(() => {
    if (!source) return;
    const timer = setTimeout(
      () => {
        setSource(null);
        setError("Liên kết xem đã hết hạn. Mở lại để tiếp tục xem bản ghi.");
      },
      Math.max(
        0,
        Math.min(2_147_483_647, Date.parse(source.expiresAt) - Date.now()),
      ),
    );
    return () => clearTimeout(timer);
  }, [source]);
  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}
      supportedOrientations={["portrait", "landscape"]}
    >
      <SafeAreaView style={styles.page}>
        <View style={styles.header}>
          <View style={styles.spread}>
            <Text style={styles.heading}>Xem lại buổi học</Text>
            <Button variant="paper" size="sm" onPress={onClose}>
              Đóng
            </Button>
          </View>
          <Text style={styles.muted}>
            Bản ghi dành cho người tham gia buổi học.
          </Text>
        </View>
        <View style={styles.content}>
          {!error && !source && active && (
            <ActivityIndicator accessibilityLabel="Đang mở bản ghi" />
          )}
          {source && active && !error && (
            <PlayerBoundary key={source.url}>
              <Suspense
                fallback={
                  <ActivityIndicator accessibilityLabel="Đang mở trình phát" />
                }
              >
                <Video
                  url={source.url}
                  startAt={position.current}
                  onProgress={progress}
                  onError={failed}
                />
              </Suspense>
            </PlayerBoundary>
          )}
          {!!error && (
            <>
              <FormNotice tone="error">{error}</FormNotice>
              <Button
                variant="paper"
                onPress={() => setAttempt((value) => value + 1)}
              >
                Mở lại bản ghi
              </Button>
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
