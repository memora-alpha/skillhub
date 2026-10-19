import { PathReadFeedback } from "../components/PathReadFeedback";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { Button } from "@/components/Button";
import { ControlledInput } from "@/components/ControlledInput";
import { EmptyState } from "@/components/EmptyState";
import {
  ConnectionFeedback,
  useConnections,
  useConnectionCommand,
  useCatalogName,
} from "@/features/connections";
import {
  useLearningPath,
  useLearningPathsApi,
} from "../hooks/use-learning-paths-api";
import {
  canSchedule,
  canConfirmSchedule,
  ownConfirmation,
  scheduleStatusLabel,
} from "../policy-api";
import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";
import {
  scheduleInputSchema,
  scheduleItems,
  type ScheduleInput,
} from "../schedule-input";

export function ApiSchedulesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useLearningPath(id),
    path = query.data;
  return (
    <FeaturePage
      title="Lịch của từng kế hoạch"
      demo={false}
      back={`/paths/${id}`}
    >
      <PathReadFeedback query={query} />
      {path && (
        <>
          <Copy muted>
            Giờ hiển thị theo múi giờ thiết bị. Lịch cần cả hai xác nhận; chỉ
            khi chốt lộ trình mới tạo buổi học và tạm giữ Credit.
          </Copy>
          {path.status !== "CONFIRMED" && path.lockedVersion === null && (
            <Copy>
              Cần đủ kế hoạch, xác nhận người học và xác nhận điều khoản của cả
              hai trước khi đề xuất lịch.
            </Copy>
          )}
          {path.plans.map((plan) => (
            <SchedulePanel
              key={plan.id}
              path={path}
              plan={plan}
              blocked={!!query.error || query.isFetching}
            />
          ))}
          {path.lockedVersion === null && (
            <RouteButton href={`/paths/${id}/hold`}>
              Kiểm tra trước khi chốt lịch
            </RouteButton>
          )}
        </>
      )}
    </FeaturePage>
  );
}
function SchedulePanel({
  path,
  plan,
  blocked,
}: Readonly<{
  path: ApiLearningPath;
  plan: ApiLearningPlan;
  blocked: boolean;
}>) {
  const api = useLearningPathsApi(),
    command = useConnectionCommand(),
    runtime = useConnections();
  const skill = useCatalogName(plan.skillId),
    schedule = plan.schedule;
  const partnerConfirmedAt =
    path.participantAId === runtime.userId
      ? schedule?.participantBConfirmedAt
      : schedule?.participantAConfirmedAt;
  return (
    <Panel title={skill.data ?? "Kế hoạch học"}>
      <Copy>
        {plan.teacherId === runtime.userId ? "Bạn dạy" : "Bạn học"} ·{" "}
        {plan.totalSessions} buổi
      </Copy>
      {!schedule && (
        <Copy muted>
          Chưa có đề xuất lịch. Người dạy của kế hoạch này sẽ đề xuất lịch.
        </Copy>
      )}
      {schedule && (
        <>
          <Copy>
            Lịch v{schedule.version} · {scheduleStatusLabel[schedule.status]}
          </Copy>
          {schedule.items.map((s) => (
            <Copy key={s.sessionNo}>
              Buổi {s.sessionNo}: {new Date(s.startAt).toLocaleString("vi-VN")}{" "}
              – {new Date(s.endAt).toLocaleString("vi-VN")}
            </Copy>
          ))}
          <Copy>
            Bạn:{" "}
            {ownConfirmation(path, schedule, runtime.userId)
              ? "đã xác nhận"
              : "chưa xác nhận"}{" "}
            · Đối tác: {partnerConfirmedAt ? "đã xác nhận" : "chưa xác nhận"}
          </Copy>
          {canConfirmSchedule(path, plan, runtime.userId) && (
            <Button
              disabled={blocked || command.pending}
              onPress={() => {
                void command.run(
                  `schedule:${schedule.id}:${schedule.version}`,
                  () => api.confirmSchedule(schedule.id, schedule.version),
                );
              }}
            >
              Xác nhận lịch v{schedule.version}
            </Button>
          )}
          <ConnectionFeedback error={command.error} />
        </>
      )}
      {canSchedule(path, plan, runtime.userId) && !blocked && (
        <RouteButton href={`/paths/${path.id}/schedules/${plan.id}`}>
          Đề xuất lịch tôi dạy
        </RouteButton>
      )}
      {plan.sessions.length > 0 && (
        <>
          <Copy>Buổi học đã tạo:</Copy>
          {plan.sessions.map((s) => (
            <Copy key={s.id}>
              Buổi {s.sessionNo}: {new Date(s.startAt).toLocaleString("vi-VN")}{" "}
              · {s.status}
            </Copy>
          ))}
        </>
      )}
    </Panel>
  );
}
export function ApiScheduleEditorScreen() {
  const { id, planId } = useLocalSearchParams<{ id: string; planId: string }>();
  const query = useLearningPath(id),
    runtime = useConnections(),
    path = query.data;
  const plan = path?.plans.find((p) => p.id === planId);
  return (
    <FeaturePage
      title="Đề xuất lịch tôi dạy"
      demo={false}
      back={`/paths/${id}/schedules`}
    >
      <PathReadFeedback query={query} />
      {path &&
      plan &&
      canSchedule(path, plan, runtime.userId) &&
      !query.error ? (
        <ScheduleForm
          key={`${path.currentVersion}:${plan.version}`}
          path={path}
          plan={plan}
          blocked={query.isFetching}
        />
      ) : (
        path && (
          <EmptyState
            title="Chưa thể đề xuất lịch"
            description="Chỉ người dạy đề xuất lịch sau khi kế hoạch và điều khoản đã xác nhận. Mỗi kế hoạch có một đề xuất lịch cho phiên bản hiện tại."
          />
        )
      )}
    </FeaturePage>
  );
}
function ScheduleForm({
  path,
  plan,
  blocked,
}: Readonly<{
  path: ApiLearningPath;
  plan: ApiLearningPlan;
  blocked: boolean;
}>) {
  const api = useLearningPathsApi(),
    command = useConnectionCommand(),
    router = useRouter();
  const { control, handleSubmit } = useForm<ScheduleInput>({
    resolver: zodResolver(scheduleInputSchema),
    defaultValues: {
      items: Array.from({ length: plan.totalSessions }, () => ({
        local: "",
        minutes: "60",
      })),
    },
  });
  return (
    <Panel title={`Lịch cho ${plan.totalSessions} buổi`}>
      <Copy muted>
        Nhập giờ theo múi giờ thiết bị:{" "}
        {Intl.DateTimeFormat().resolvedOptions().timeZone}. Định dạng
        2026-11-20T19:00. Lịch gửi đi chưa thể sửa trực tiếp.
      </Copy>
      {plan.sessionOutline.map((s, i) => (
        <Panel key={s.sessionNo} title={`Buổi ${s.sessionNo}: ${s.content}`}>
          <ControlledInput
            control={control}
            name={`items.${i}.local`}
            label="Ngày giờ bắt đầu"
            placeholder="YYYY-MM-DDTHH:mm"
            editable={!blocked && !command.pending}
          />
          <ControlledInput
            control={control}
            name={`items.${i}.minutes`}
            label="Thời lượng (phút)"
            keyboardType="number-pad"
            editable={!blocked && !command.pending}
          />
        </Panel>
      ))}
      <ConnectionFeedback error={command.error} />
      <Button
        disabled={blocked || command.pending}
        onPress={() => {
          void handleSubmit(async (input) => {
            const items = scheduleItems(input);
            const result = await command.run(
              JSON.stringify({ id: plan.id, version: plan.version, items }),
              () => api.schedule(plan.id, plan.version, items),
            );
            if (result) router.replace(`/paths/${path.id}/schedules`);
          })();
        }}
      >
        {command.pending ? "Đang gửi..." : "Gửi đề xuất lịch"}
      </Button>
    </Panel>
  );
}
