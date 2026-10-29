import { useCallback, useRef, useState } from "react";
import { ZodError } from "zod";
import { StyleSheet, Text, View } from "react-native";
import { useForm, useWatch } from "react-hook-form";
import { useFocusEffect, useRouter } from "expo-router";
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
import { useEditorSnapshot } from "../hooks/use-editor-snapshot";
import { EditorRevisionNotice } from "./editor-revision-notice";
import {
  previewScheduleItems,
  scheduleConflicts,
  scheduleConflictMessage,
} from "../utils/schedule-conflicts";
import { useExistingScheduleCheck } from "../hooks/use-existing-schedule-check";
import { existingScheduleConflictMessage } from "../utils/schedule-existing-conflicts";
import { ScheduleExistingFeedback } from "./schedule-existing-feedback";

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
  path: latestPath,
  plan: latestPlan,
  blocked,
}: Readonly<{
  path: ApiLearningPath;
  plan: ApiLearningPlan;
  blocked: boolean;
}>) {
  const snapshot = useEditorSnapshot(
    `${latestPath.currentVersion}:${latestPlan.version}:${latestPlan.schedule?.version ?? "new"}`,
    { path: latestPath, plan: latestPlan },
  );
  const { path, plan } = snapshot.value;
  const api = useLearningPathsApi(),
    command = useConnectionCommand([
      ["learning-paths", path.id],
      ["learning-paths", "mine"],
    ]),
    router = useRouter();
  const [active, setActive] = useState<number | null>(null);
  const [applied, setApplied] = useState(0);
  const focus = useRef({ active: false, epoch: 0 });
  useFocusEffect(
    useCallback(() => {
      focus.current.active = true;
      focus.current.epoch++;
      return () => {
        focus.current.active = false;
        focus.current.epoch++;
      };
    }, []),
  );
  const otherPlans = useRef(latestPath.plans);
  otherPlans.current = latestPath.plans.filter((other) => other.id !== plan.id);
  const schedule = plan.schedule;
  const { control, handleSubmit, setValue, reset, setError } =
    useForm<ScheduleInput>({
      resolver: zodResolver(scheduleInputSchema),
      defaultValues: scheduleDraft(plan),
    });
  const disabled =
    blocked || command.pending || command.uncertain || snapshot.changed;
  const existing = useExistingScheduleCheck(
    control,
    plan,
    path.id,
    !blocked && !snapshot.changed,
    applied,
  );
  const draftItems = useWatch({ control, name: "items" });
  const hasConflicts =
    existing.conflicts.length > 0 ||
    scheduleConflicts(
      previewScheduleItems(draftItems ?? [], schedule?.items),
      otherPlans.current,
    ).length > 0;
  const canSubmit = useRef(false);
  canSubmit.current = !disabled;
  const canSave = useRef(false);
  canSave.current = !disabled && !hasConflicts;
  const action = (
    <Button
      disabled={!canSave.current || existing.blocked}
      onPress={() => {
        const epoch = focus.current.epoch;
        const current = () =>
          focus.current.active && focus.current.epoch === epoch;
        if (
          !current() ||
          !canSave.current ||
          existing.blocked ||
          !snapshot.isCurrent()
        )
          return;
        void handleSubmit(
          async (input) => {
            if (!current() || !canSave.current || !snapshot.isCurrent()) return;
            let items: ReturnType<typeof scheduleDraftItems>;
            try {
              items = scheduleDraftItems(input, plan);
            } catch (error) {
              if (!(error instanceof ZodError)) throw error;
              for (const issue of error.issues) {
                const index =
                  typeof issue.path[1] === "number" ? issue.path[1] : 0;
                const field = issue.path[2] === "minutes" ? "minutes" : "local";
                setError(`items.${index}.${field}`, {
                  type: "validate",
                  message: issue.message,
                });
              }
              const first = error.issues[0]?.path[1];
              setActive(typeof first === "number" ? first : 0);
              return;
            }
            const conflicts = scheduleConflicts(items, otherPlans.current);
            if (conflicts.length) {
              for (const conflict of conflicts) {
                setError(`items.${conflict.slot.sessionNo - 1}.local`, {
                  type: "validate",
                  message: scheduleConflictMessage(conflict),
                });
              }
              setActive(conflicts[0]!.slot.sessionNo - 1);
              return;
            }
            const checked = await existing.validate(items);
            if (
              !current() ||
              !canSave.current ||
              !snapshot.isCurrent() ||
              checked.pending ||
              checked.unavailable
            )
              return;
            if (checked.conflicts.length) {
              for (const conflict of checked.conflicts) {
                setError(`items.${conflict.slot.sessionNo - 1}.local`, {
                  type: "validate",
                  message: existingScheduleConflictMessage(conflict),
                });
              }
              setActive(checked.conflicts[0]!.slot.sessionNo - 1);
              return;
            }
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
            if (result && current())
              router.dismissTo(`/paths/${path.id}/schedules`);
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
      <EditorRevisionNotice
        visible={snapshot.changed}
        disabled={blocked || command.pending || command.uncertain}
        onReload={() => {
          const current = snapshot.reload();
          reset(scheduleDraft(current.plan));
          setActive(null);
          setApplied(0);
        }}
      />
      <ScheduleWeeklyGenerator
        count={plan.totalSessions}
        disabled={disabled}
        onApply={(items) => {
          if (
            !focus.current.active ||
            !canSubmit.current ||
            !snapshot.isCurrent()
          )
            return;
          setValue("items", items, { shouldDirty: true, shouldValidate: true });
          setActive(null);
          setApplied((version) => version + 1);
        }}
      />
      {applied > 0 && (
        <FormNotice tone="success" compact>
          Đã điền lịch tuần. Xem lại hoặc sửa từng buổi trước khi gửi.
        </FormNotice>
      )}
      {schedule && (
        <Copy muted size="hint">
          Lịch thay đổi cần cả hai xác nhận lại.
        </Copy>
      )}
      <ScheduleExistingFeedback check={existing} />
      <ScheduleSessionEditor
        path={latestPath}
        plan={plan}
        control={control}
        disabled={disabled}
        active={active}
        existingConflicts={existing.conflicts}
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
            Hai bên xác nhận cùng phiên bản. Chốt lịch mới tạm giữ Credit và tạo
            buổi học.
          </Text>
        </View>
      </View>
      <ConnectionFeedback error={command.error} />
      {command.uncertain && (
        <FlowSection title="Kiểm tra lịch vừa gửi">
          <Copy size="hint">
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
