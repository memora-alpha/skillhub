import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useForm } from "react-hook-form";
import { useRouter } from "expo-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, RouteButton } from "@/components/feature-page";
import { FlowSection } from "@/components/learning-flow";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";

import { FormNotice } from "@/components/FormNotice";
import {
  ConnectionFeedback,
  useConnectionCommand,
} from "@/features/connections";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";
import {
  scheduleInputSchema,
  type ScheduleInput,
} from "../schemas/schedule-input";
import { scheduleDraft, scheduleDraftItems } from "../utils/schedule-draft";
import { useLearningPathsApi } from "../hooks/use-learning-paths-api";
import { PlanEditorFrame } from "./plan-editor-fields";
import { ScheduleWeeklyGenerator } from "./schedule-weekly-generator";
import { ScheduleSessionEditor } from "./schedule-session-editor";

function scheduleButtonLabel(
  pending: boolean,
  hasSchedule: boolean,
  count: number,
) {
  if (pending) return "Đang gửi…";
  const action = hasSchedule ? "Lưu thay đổi lịch" : "Gửi đề xuất lịch";
  return `${action} (${count} buổi)`;
}

export function ScheduleForm({
  path,
  plan,
  blocked,
}: Readonly<{
  path: ApiLearningPath;
  plan: ApiLearningPlan;
  blocked: boolean;
}>) {
  const api = useLearningPathsApi(),
    command = useConnectionCommand([
      ["learning-paths", path.id],
      ["learning-paths", "mine"],
    ]),
    router = useRouter();
  const [active, setActive] = useState<number | null>(null);
  const [applied, setApplied] = useState(false);
  const schedule = plan.schedule;
  const { control, handleSubmit, setValue } = useForm<ScheduleInput>({
    resolver: zodResolver(scheduleInputSchema),
    defaultValues: scheduleDraft(plan),
  });
  const disabled = blocked || command.pending || command.uncertain;
  const action = (
    <Button
      disabled={disabled}
      onPress={() => {
        if (disabled) return;
        void handleSubmit(
          async (input) => {
            const items = scheduleDraftItems(input, plan);
            const result = await command.run(
              JSON.stringify({
                id: plan.id,
                version: plan.version,
                scheduleId: schedule?.id,
                scheduleVersion: schedule?.version,
                items,
              }),
              () =>
                schedule
                  ? api.reviseSchedule(schedule.id, schedule.version, items)
                  : api.schedule(plan.id, plan.version, items),
            );
            if (result) router.dismissTo(`/paths/${path.id}/schedules`);
          },
          (errors) => {
            const index = Array.from(
              { length: plan.totalSessions },
              (_, i) => i,
            ).find((i) => errors.items?.[i]);
            if (index !== undefined) setActive(index);
          },
        )();
      }}
    >
      {scheduleButtonLabel(command.pending, !!schedule, plan.totalSessions)}
    </Button>
  );
  return (
    <PlanEditorFrame action={action}>
      <ScheduleWeeklyGenerator
        count={plan.totalSessions}
        disabled={disabled}
        onApply={(items) => {
          if (disabled) return;
          setValue("items", items, { shouldDirty: true, shouldValidate: true });
          setActive(null);
          setApplied(true);
        }}
      />
      {applied && (
        <FormNotice tone="success">
          Đã điền lịch tuần. Xem lại hoặc sửa từng buổi trước khi gửi.
        </FormNotice>
      )}
      {schedule && (
        <Copy muted>
          Giữ nguyên giờ của các buổi chưa sửa. Nếu lịch thay đổi, hai bên cần
          xác nhận phiên bản mới.
        </Copy>
      )}
      <ScheduleSessionEditor
        plan={plan}
        control={control}
        disabled={disabled}
        active={active}
        onEdit={setActive}
      />
      <Text style={styles.note}>
        Giờ theo thiết bị · {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </Text>
      <View style={styles.policy}>
        <Icon name="shield" size={20} color={colors.info} />
        <View style={styles.policyContent}>
          <Text style={styles.policyTitle}>Trước khi chốt lịch</Text>
          <Text style={styles.policyText}>
            Hai bên cần xác nhận cùng phiên bản lịch. Credit chỉ tạm giữ và buổi
            học chỉ được tạo khi chốt thỏa thuận.
          </Text>
        </View>
      </View>
      <ConnectionFeedback error={command.error} />
      {command.uncertain && (
        <FlowSection title="Kiểm tra lịch vừa gửi">
          <Copy>
            Chưa xác định được kết quả. Giữ nguyên nội dung và xem lại trạng
            thái trước khi gửi thêm lịch.
          </Copy>
          <RouteButton href={`/paths/${path.id}/schedules`}>
            Xem trạng thái lịch
          </RouteButton>
        </FlowSection>
      )}
    </PlanEditorFrame>
  );
}
const styles = StyleSheet.create({
  policy: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    backgroundColor: colors.infoSoft,
    borderColor: colors.infoBorder,
    borderWidth: 1,
    borderRadius: appRadius.control,
  },
  policyContent: { flex: 1, gap: 4 },
  policyTitle: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.info,
  },
  policyText: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.body,
  },
  note: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
});
