import { PathReadFeedback } from "../components/PathReadFeedback";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FeaturePage,
  Panel,
  Copy,
  RouteButton,
} from "@/components/feature-page";
import { Button } from "@/components/Button";
import { ControlledInput } from "@/components/ControlledInput";
import { FormNotice } from "@/components/FormNotice";
import { RequestDateField } from "@/features/learning-requests";
import { JourneyProgress } from "../components/LearningJourney";
import { learningJourney } from "../journey";
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
  const runtime = useConnections();
  const journey = path ? learningJourney(path, runtime.userId) : undefined;
  return (
    <FeaturePage
      title="Chọn lịch học cùng nhau"
      demo={false}
      back={`/paths/${id}`}
    >
      <JourneyProgress
        step={journey?.step ?? 3}
        done={path?.lockedVersion != null}
      />
      {path && (
        <>
          <Copy muted>
            Mỗi người chọn lịch cho phần mình dạy. Cả hai xem và đồng ý từng
            lịch; Credit chỉ tạm giữ ở bước chốt sau cùng.
          </Copy>
          {path.status !== "CONFIRMED" && path.lockedVersion === null && (
            <Panel title="Còn một bước trước khi chọn lịch">
              <Copy>{journey?.description}</Copy>
              <RouteButton href={`/paths/${id}`}>
                Về nội dung học để tiếp tục
              </RouteButton>
            </Panel>
          )}
          {path.plans.map((plan) => (
            <SchedulePanel
              key={plan.id}
              path={path}
              plan={plan}
              blocked={!!query.error || query.isFetching}
            />
          ))}
          {journey?.step === 4 &&
            path.lockedVersion === null &&
            !query.error &&
            !query.isFetching && (
              <RouteButton href={`/paths/${id}/hold`}>
                Tiếp tục: xem lại và chốt lịch
              </RouteButton>
            )}
        </>
      )}
      <PathReadFeedback query={query} />
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
    <Panel
      title={`${plan.teacherId === runtime.userId ? "Lịch bạn dạy" : "Lịch bạn học"} · ${skill.data ?? "Kỹ năng"}`}
    >
      <Copy>
        {plan.teacherId === runtime.userId ? "Bạn dạy" : "Bạn học"} ·{" "}
        {plan.totalSessions} buổi
      </Copy>
      {!schedule && (
        <Copy muted>
          {plan.teacherId === runtime.userId
            ? "Bạn chọn ngày giờ cho các buổi này rồi gửi người trao đổi xem."
            : "Đang chờ người trao đổi chọn ngày giờ cho phần họ dạy."}
        </Copy>
      )}
      {schedule && (
        <>
          <Copy>{scheduleStatusLabel[schedule.status]}</Copy>
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
            · Người trao đổi:{" "}
            {partnerConfirmedAt ? "đã xác nhận" : "chưa xác nhận"}
          </Copy>
          {canConfirmSchedule(path, plan, runtime.userId) && (
            <Button
              disabled={blocked || command.pending || command.uncertain}
              onPress={() => {
                if (blocked || command.pending || command.uncertain) return;
                void command.run(
                  `schedule:${schedule.id}:${schedule.version}`,
                  () => api.confirmSchedule(schedule.id, schedule.version),
                );
              }}
            >
              Tôi đồng ý lịch này
            </Button>
          )}
          <ConnectionFeedback error={command.error} />
          {command.uncertain && (
            <Button
              variant="paper"
              disabled={command.pending}
              onPress={() => {
                void command.retry();
              }}
            >
              Kiểm tra lại lần xác nhận vừa gửi
            </Button>
          )}
        </>
      )}
      {canSchedule(path, plan, runtime.userId) && !blocked && (
        <RouteButton href={`/paths/${path.id}/schedules/${plan.id}`}>
          Chọn ngày giờ bạn dạy
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
      title="Chọn ngày giờ bạn dạy"
      demo={false}
      back={`/paths/${id}/schedules`}
    >
      <JourneyProgress step={3} />
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
  const { control, handleSubmit, formState } = useForm<ScheduleInput>({
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
        {Intl.DateTimeFormat().resolvedOptions().timeZone}. Chạm để chọn ngày và
        giờ. Kiểm tra kỹ trước khi gửi: lịch đề xuất chưa có thao tác sửa trực
        tiếp.
      </Copy>
      {plan.sessionOutline.map((s, i) => (
        <Panel key={s.sessionNo} title={`Buổi ${s.sessionNo}: ${s.content}`}>
          <Controller
            control={control}
            name={`items.${i}.local`}
            render={({ field }) => (
              <RequestDateField
                label={`Ngày giờ buổi ${s.sessionNo}`}
                value={field.value}
                onChange={field.onChange}
                disabled={blocked || command.pending || command.uncertain}
              />
            )}
          />
          {formState.errors.items?.[i]?.local?.message && (
            <FormNotice tone="error">
              {formState.errors.items[i]!.local!.message}
            </FormNotice>
          )}
          <ControlledInput
            control={control}
            name={`items.${i}.minutes`}
            label="Thời lượng (phút)"
            keyboardType="number-pad"
            editable={!blocked && !command.pending && !command.uncertain}
            hint="Từ 60 đến 180 phút mỗi buổi."
          />
        </Panel>
      ))}
      <ConnectionFeedback error={command.error} />
      <Button
        disabled={blocked || command.pending || command.uncertain}
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
        {command.pending ? "Đang gửi..." : "Gửi lịch để cùng xác nhận"}
      </Button>
      {command.uncertain && (
        <Button
          variant="paper"
          disabled={command.pending}
          onPress={() => {
            void command.retry().then((result) => {
              if (result) router.replace(`/paths/${path.id}/schedules`);
            });
          }}
        >
          Kiểm tra lại lịch vừa gửi
        </Button>
      )}
    </Panel>
  );
}
