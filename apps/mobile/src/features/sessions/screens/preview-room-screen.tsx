import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import {
  SessionPage as FeaturePage,
  SessionPanel as Panel,
  SessionCopy as Copy,
  SessionRouteButton as RouteButton,
  SessionButton as Button,
  SessionEmptyState as EmptyState,
} from "../components/session-page";
import { sessionUi as ui } from "../components/session-page.styles";
import { useSessionsPreview } from "../context";
export function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions } = useSessionsPreview();
  const s = sessions.find((item) => item.id === id);
  const [stage, setStage] = useState("waiting");
  const [camera, setCamera] = useState(false);
  const [mic, setMic] = useState(false);
  const [leave, setLeave] = useState(false);
  return (
    <FeaturePage title="Phòng học" demo back={`/learning-sessions/${id}`}>
      {!s || s.status !== "CONFIRMED" ? (
        <EmptyState
          title="Phòng học không khả dụng"
          description="Buổi học đã kết thúc, đang có tranh chấp hoặc chưa đủ điều kiện vào phòng."
        />
      ) : (
        <>
          <Panel
            title={
              stage === "ended"
                ? "Bạn đã rời phòng mẫu"
                : stage === "waiting"
                  ? "Chuẩn bị buổi học"
                  : s.title
            }
            accent
          >
            <Copy>
              {stage === "waiting"
                ? "Kiểm tra thiết bị trước khi vào phòng. Giờ mở phòng thực tế do backend cấu hình."
                : stage === "ended"
                  ? "Rời phòng không xác nhận hoàn thành buổi học."
                  : `Khung video mẫu · ${s.partner}`}
            </Copy>
            {stage !== "ended" && (
              <>
                <View style={ui.row}>
                  <Button variant="paper" onPress={() => setCamera((v) => !v)}>
                    {camera ? "Tắt camera mẫu" : "Bật camera mẫu"}
                  </Button>
                  <Button variant="paper" onPress={() => setMic((v) => !v)}>
                    {mic ? "Tắt mic mẫu" : "Bật mic mẫu"}
                  </Button>
                </View>
                <Copy muted>
                  Không truy cập camera/microphone hoặc kết nối phòng thật trong
                  bản xem thử.
                </Copy>
              </>
            )}
            {stage === "waiting" && (
              <Button onPress={() => setStage("room")}>
                Vào giao diện phòng mẫu
              </Button>
            )}
            {stage === "room" && (
              <Button variant="paper" onPress={() => setLeave(true)}>
                Rời phòng
              </Button>
            )}
          </Panel>
          {leave && (
            <Panel title="Rời buổi học?">
              <Copy>Thao tác này chỉ đóng giao diện phòng mẫu.</Copy>
              <Button
                onPress={() => {
                  setStage("ended");
                  setLeave(false);
                }}
              >
                Xác nhận rời phòng
              </Button>
              <Button variant="paper" onPress={() => setLeave(false)}>
                Ở lại
              </Button>
            </Panel>
          )}
          <RouteButton secondary href={`/learning-sessions/${id}`}>
            Chi tiết buổi học
          </RouteButton>
        </>
      )}
    </FeaturePage>
  );
}
