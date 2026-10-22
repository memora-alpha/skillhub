import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { z } from "zod";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { DataForm, textRule, integerRule } from "@/components/data-form";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
  ui,
} from "@/components/feature-page";
import { canReschedule } from "@/features/learning-paths/policy";
import { useSessionsPreview } from "./context";
import { parseLocalDateTime } from "@/utils/local-date-time";
export function RescheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, save } = useSessionsPreview();
  const s = sessions.find((item) => item.id === id);
  const router = useRouter();
  return (
    <FeaturePage title="Đề nghị đổi lịch" back={`/learning-sessions/${id}`}>
      {!s || s.status !== "CONFIRMED" || !canReschedule(s.startAt) ? (
        <EmptyState
          title="Không thể đổi lịch"
          description="Hai bên phải xác nhận lịch mới ít nhất 60 phút trước giờ bắt đầu của lịch cũ."
        />
      ) : (
        <Panel title="Giữ lịch cũ đến khi chốt lịch mới">
          <Copy>
            Lịch hiện tại: {new Date(s.startAt).toLocaleString("vi-VN")}
          </Copy>
          <DataForm
            fields={[
              {
                name: "start",
                label: "Ngày giờ mới (YYYY-MM-DDTHH:mm)",
                rule: z
                  .string()
                  .refine(
                    (v) => (parseLocalDateTime(v)?.getTime() ?? 0) > Date.now(),
                    "Nhập ngày giờ tương lai hợp lệ.",
                  ),
                hint: "Sử dụng giờ địa phương trên thiết bị.",
              },
              {
                name: "duration",
                label: "Thời lượng (phút)",
                rule: integerRule(60, 180),
                numeric: true,
              },
              {
                name: "reason",
                label: "Lý do đổi lịch",
                rule: textRule(10, 1000),
                multiline: true,
              },
            ]}
            defaults={{ duration: String(s.duration) }}
            submitLabel="Gửi đề nghị mẫu"
            onSubmit={(v) => {
              if (!canReschedule(s.startAt))
                return "Đã qua hạn chốt thay đổi lịch.";
              const startAt = parseLocalDateTime(v.start!)!.toISOString();
              const duration = Number(v.duration);
              if (
                sessions.some(
                  (other) =>
                    other.id !== id &&
                    ["CONFIRMED", "DISPUTED"].includes(other.status) &&
                    Date.parse(startAt) <
                      Date.parse(other.startAt) + other.duration * 60000 &&
                    Date.parse(startAt) + duration * 60000 >
                      Date.parse(other.startAt),
                )
              )
                return "Thời gian mới trùng một buổi học khác.";
              save({
                ...s,
                change: {
                  startAt,
                  duration,
                  reason: v.reason!,
                  version: (s.change?.version ?? 0) + 1,
                  meConfirmed: true,
                  partnerConfirmed: false,
                  requestedBy: "me",
                },
              });
              router.replace(`/learning-sessions/${id}`);
            }}
          />
        </Panel>
      )}
    </FeaturePage>
  );
}
export function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions } = useSessionsPreview();
  const s = sessions.find((item) => item.id === id);
  const [stage, setStage] = useState("waiting");
  const [camera, setCamera] = useState(false);
  const [mic, setMic] = useState(false);
  const [leave, setLeave] = useState(false);
  return (
    <FeaturePage title="Phòng học LiveKit" back={`/learning-sessions/${id}`}>
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
