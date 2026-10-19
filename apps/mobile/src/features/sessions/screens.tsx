import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";
import { z } from "zod";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FormNotice } from "@/components/FormNotice";
import { DataForm, textRule, integerRule } from "@/components/data-form";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
  ui,
} from "@/components/feature-page";
import { canReschedule } from "@/features/learning-paths";
import { useSessionsPreview } from "./context";
import { parseLocalDateTime } from "@/utils/local-date-time";
export function PathSessionsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { sessions } = useSessionsPreview();
  const items = sessions.filter((s) => !id || s.pathId === id);
  return (
    <FeaturePage
      title={id ? "Buổi học của lộ trình" : "Lịch sử học tập"}
      back={id ? `/paths/${id}` : "/calendar"}
    >
      {items.map((s) => (
        <Panel key={s.id} title={s.title}>
          <Badge label={s.status} />
          <Copy>
            {s.partner} · {new Date(s.startAt).toLocaleString("vi-VN")} ·{" "}
            {s.duration} phút
          </Copy>
          <RouteButton href={`/learning-sessions/${s.id}`}>
            Chi tiết buổi học
          </RouteButton>
        </Panel>
      ))}
      {!items.length && (
        <EmptyState
          title="Chưa có buổi học"
          description="Các buổi học xuất hiện sau khi tất cả lịch được xác nhận và khóa."
        />
      )}
    </FeaturePage>
  );
}
export function LearningSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, save, confirmChange } = useSessionsPreview();
  const [error, setError] = useState<string>();
  const s = sessions.find((item) => item.id === id);
  return (
    <FeaturePage
      title="Chi tiết buổi học"
      back={s ? `/paths/${s.pathId}/sessions` : "/paths"}
    >
      {!s ? (
        <EmptyState
          title="Không tìm thấy buổi học"
          description="Buổi học không có trong bản xem thử."
        />
      ) : (
        <>
          <Panel title={s.title}>
            <Badge label={s.status} />
            <Copy>
              {s.partner} · Bạn {s.mine ? "dạy" : "học"}
            </Copy>
            <Copy>
              {new Date(s.startAt).toLocaleString("vi-VN")} · {s.duration} phút
            </Copy>
            <Copy muted>
              Kế hoạch: {s.planId}. Lộ trình: {s.pathId}.
            </Copy>
            {s.change && (
              <FormNotice tone="info">
                Đề xuất đổi lịch v{s.change.version}:{" "}
                {new Date(s.change.startAt).toLocaleString("vi-VN")}.{" "}
                {s.change.applied
                  ? "Đã đủ hai bên xác nhận; lịch mới đã có hiệu lực."
                  : s.change.meConfirmed
                    ? "Chờ đối tác xác nhận; lịch cũ vẫn có hiệu lực."
                    : "Đối tác đã xác nhận. Chờ bạn xem và xác nhận trước hạn; lịch cũ vẫn có hiệu lực."}
              </FormNotice>
            )}
          </Panel>
          {error && <FormNotice tone="error">{error}</FormNotice>}
          {s.change && !s.change.applied && !s.change.meConfirmed && (
            <Panel title={`Đề nghị đổi lịch v${s.change.version}`}>
              <Copy>{s.change.reason}</Copy>
              <Button onPress={() => setError(confirmChange(id))}>
                Xác nhận đề nghị đổi lịch này
              </Button>
              <Button
                variant="paper"
                onPress={() => {
                  save({ ...s, change: undefined });
                  setError(undefined);
                }}
              >
                Giữ lịch cũ
              </Button>
            </Panel>
          )}
          {s.status === "CONFIRMED" && (
            <>
              <RouteButton href={`/learning-sessions/${id}/room`}>
                Xem thử phòng học LiveKit
              </RouteButton>
              <RouteButton
                secondary
                href={`/learning-sessions/${id}/reschedule`}
              >
                Đề nghị đổi lịch
              </RouteButton>
            </>
          )}
          {["AWAITING_CONFIRMATION", "COMPLETED"].includes(s.status) && (
            <RouteButton href={`/learning-sessions/${id}/completion`}>
              Xác nhận & kết quả buổi học
            </RouteButton>
          )}
          <RouteButton
            secondary
            href={{
              pathname: "/reports/new",
              params: { pathId: s.pathId, sessionId: s.id },
            }}
          >
            Báo cáo vấn đề buổi học
          </RouteButton>
          <RouteButton secondary href={`/paths/${s.pathId}`}>
            Xem tiến độ toàn lộ trình
          </RouteButton>
        </>
      )}
    </FeaturePage>
  );
}
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
export function CompletionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, confirm } = useSessionsPreview();
  const s = sessions.find((item) => item.id === id);
  return (
    <FeaturePage title="Xác nhận đã học" back={`/learning-sessions/${id}`}>
      {!s ? (
        <EmptyState
          title="Không tìm thấy buổi học"
          description="Không thể xác nhận."
        />
      ) : (
        <Panel
          title={
            s.status === "COMPLETED"
              ? "Buổi học đã hoàn thành"
              : "Cùng xác nhận sau buổi học"
          }
        >
          <Copy>{s.title}</Copy>
          <Copy>
            Bạn: {s.meConfirmed ? "Đã xác nhận" : "Chưa xác nhận"} · Đối tác:{" "}
            {s.partnerConfirmed ? "Đã xác nhận" : "Chưa xác nhận"}
          </Copy>
          <Button
            disabled={
              s.status !== "AWAITING_CONFIRMATION" ||
              !!s.meConfirmed ||
              Date.now() < Date.parse(s.startAt) + s.duration * 60000
            }
            onPress={() => confirm(id)}
          >
            Tôi xác nhận đã học buổi này
          </Button>
          <Copy muted>
            Chỉ đủ xác nhận của hai người sau giờ kết thúc mới hoàn thành buổi
            học. Credit tiếp tục được giữ đến cuối lộ trình.
          </Copy>
          <RouteButton secondary href={`/paths/${s.pathId}`}>
            Xem tiến độ lộ trình
          </RouteButton>
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
