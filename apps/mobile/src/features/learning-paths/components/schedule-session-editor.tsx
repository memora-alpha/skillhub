import { StyleSheet, Text, View } from "react-native";
import {
  Controller,
  useWatch,
  useFormState,
  type Control,
} from "react-hook-form";
import { ScheduleTimeFields } from "./schedule-time-fields";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { Icon } from "@/components/Icon";
import { FlowSection } from "@/components/learning-flow";
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
import type { ScheduleInput } from "../schemas/schedule-input";
import { scheduleSlotLabel } from "../utils/weekly-schedule";
import { sessionContentParts } from "../utils/session-content";
import { ScheduleTimelineItem } from "./schedule-timeline-item";
import { ScheduleBusyDay } from "./schedule-busy-day";
import {
  previewScheduleItems,
  scheduleConflicts,
  scheduleConflictMessage,
} from "../utils/schedule-conflicts";
import {
  existingScheduleConflictMessage,
  type ExistingScheduleConflict,
} from "../utils/schedule-existing-conflicts";

export function ScheduleSessionEditor({
  path,
  plan,
  control,
  disabled,
  active,
  onEdit,
  existingConflicts = [],
}: Readonly<{
  path: ApiLearningPath;
  plan: ApiLearningPlan;
  control: Control<ScheduleInput>;
  disabled: boolean;
  active: number | null;
  onEdit: (index: number | null) => void;
  existingConflicts?: readonly ExistingScheduleConflict[];
}>) {
  const items = useWatch({ control, name: "items" });
  const { errors } = useFormState({ control });
  const slots = previewScheduleItems(items ?? [], plan.schedule?.items);
  const conflicts = scheduleConflicts(
    slots,
    path.plans.filter((other) => other.id !== plan.id),
  );
  const completed = (items ?? []).filter(
    (item) => item.local && item.minutes,
  ).length;
  return (
    <View style={styles.group}>
      <View style={styles.heading}>
        <View style={styles.sectionHeading}>
          <Text style={styles.number}>2</Text>
          <Text style={styles.title}>Lịch từng buổi</Text>
        </View>
        <Text style={styles.count}>
          {completed}/{plan.totalSessions} buổi đã điền
        </Text>
      </View>
      <Text style={styles.hint}>
        Chọn Sửa ở từng buổi để xem các khung giờ bạn đã có lịch trong ngày đó.
      </Text>
      {plan.sessionOutline.map((session, index) => {
        const open = active === index;
        const error = errors.items?.[index];
        const topic = sessionContentParts(session.content);
        const slot = slots.find((item) => item.sessionNo === session.sessionNo);
        const overlaps = conflicts.filter((conflict) =>
          conflict.source === "draft"
            ? conflict.other.sessionNo === session.sessionNo
            : conflict.slot.sessionNo === session.sessionNo,
        );
        const existingOverlaps = existingConflicts.filter(
          (conflict) => conflict.slot.sessionNo === session.sessionNo,
        );
        const warnings = [
          ...new Set([
            ...overlaps.map(scheduleConflictMessage),
            ...existingOverlaps.map(existingScheduleConflictMessage),
          ]),
        ];
        const fieldError = error?.minutes?.message ?? error?.local?.message;
        return (
          <ScheduleTimelineItem
            key={session.sessionNo}
            last={index === plan.sessionOutline.length - 1}
            gap={12}
          >
            <FlowSection>
              <View style={[styles.heading, styles.cardHeading]}>
                <Text style={styles.badge}>Buổi {session.sessionNo}</Text>
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon="edit"
                  accessibilityLabel={`Sửa lịch buổi ${session.sessionNo}`}
                  disabled={disabled}
                  onPress={() => onEdit(open ? null : index)}
                >
                  {open ? "Thu gọn" : "Sửa"}
                </Button>
              </View>
              <View style={styles.timeRow}>
                <Icon name="clock" size={18} color={colors.muted} />
                <Text style={styles.slot}>
                  {scheduleSlotLabel(
                    items?.[index] ?? { local: "", minutes: "60" },
                  )}
                </Text>
              </View>
              <View style={styles.topicBox}>
                <Text style={styles.topicTitle}>{topic.title}</Text>
                {!!topic.description && (
                  <Text style={styles.topic}>{topic.description}</Text>
                )}
              </View>
              {!!warnings.length && (
                <FormNotice tone="error" compact>
                  {`${warnings.join("\n")}\nHãy chọn giờ khác.`}
                </FormNotice>
              )}
              {!open && !!fieldError && !warnings.includes(fieldError) && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {fieldError}
                </Text>
              )}
              {open && (
                <View style={styles.editor}>
                  <Controller
                    control={control}
                    name={`items.${index}.local`}
                    render={({ field, fieldState }) => (
                      <>
                        <Controller
                          control={control}
                          name={`items.${index}.minutes`}
                          render={({
                            field: duration,
                            fieldState: durationState,
                          }) => (
                            <>
                              <ScheduleTimeFields
                                local={field.value}
                                minutes={duration.value}
                                onLocalChange={field.onChange}
                                onMinutesChange={duration.onChange}
                                disabled={disabled}
                              />
                              {!!durationState.error && (
                                <Text
                                  accessibilityRole="alert"
                                  style={styles.error}
                                >
                                  {durationState.error.message}
                                </Text>
                              )}
                            </>
                          )}
                        />
                        {!!fieldState.error &&
                          !warnings.includes(
                            fieldState.error.message ?? "",
                          ) && (
                            <Text
                              accessibilityRole="alert"
                              style={styles.error}
                            >
                              {fieldState.error.message}
                            </Text>
                          )}
                      </>
                    )}
                  />
                  {slot && (
                    <ScheduleBusyDay
                      slot={slot}
                      allowed={!disabled}
                      warnedSessionIds={existingOverlaps.map(
                        (conflict) => conflict.session.id,
                      )}
                    />
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={disabled}
                    onPress={() => onEdit(null)}
                  >
                    Xong
                  </Button>
                </View>
              )}
            </FlowSection>
          </ScheduleTimelineItem>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  number: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.ink,
    backgroundColor: colors.surfaceInset,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cardHeading: {
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  topicBox: {
    paddingVertical: 4,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.borderStrong,
    gap: 4,
  },
  topicTitle: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  group: { gap: 12 },
  hint: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  title: { ...typography.heading, fontFamily: fonts.bold, color: colors.ink },
  count: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.muted,
  },
  badge: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.body,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: appRadius.badge,
    backgroundColor: colors.surfaceLow,
  },
  slot: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.ink,
    flex: 1,
  },
  topic: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  editor: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 12,
  },
  error: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.error,
  },
});
