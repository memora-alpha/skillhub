import { StyleSheet, Text, View } from "react-native";
import {
  Controller,
  useWatch,
  useFormState,
  type Control,
} from "react-hook-form";
import { LearningDateTimeField } from "@/features/learning-requests";
import { ControlledInput } from "@/components/ControlledInput";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { FlowSection } from "@/components/learning-flow";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import type { ApiLearningPlan } from "../api/learning-paths-contract";
import type { ScheduleInput } from "../schemas/schedule-input";
import { scheduleSlotLabel } from "../utils/weekly-schedule";
import { sessionContentParts } from "../utils/session-content";
import { ScheduleTimelineItem } from "./schedule-timeline-item";

export function ScheduleSessionEditor({
  plan,
  control,
  disabled,
  active,
  onEdit,
}: Readonly<{
  plan: ApiLearningPlan;
  control: Control<ScheduleInput>;
  disabled: boolean;
  active: number | null;
  onEdit: (index: number | null) => void;
}>) {
  const items = useWatch({ control, name: "items" });
  const { errors } = useFormState({ control });
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
      {plan.sessionOutline.map((session, index) => {
        const open = active === index;
        const error = errors.items?.[index];
        const topic = sessionContentParts(session.content);
        return (
          <ScheduleTimelineItem
            key={session.sessionNo}
            last={index === plan.sessionOutline.length - 1}
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
              {!open && !!error && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error.local?.message ?? error.minutes?.message}
                </Text>
              )}
              {open && (
                <View style={styles.editor}>
                  <Controller
                    control={control}
                    name={`items.${index}.local`}
                    render={({ field, fieldState }) => (
                      <>
                        <LearningDateTimeField
                          label={`Ngày giờ buổi ${session.sessionNo}`}
                          value={field.value}
                          onChange={field.onChange}
                          disabled={disabled}
                        />
                        {!!fieldState.error && (
                          <Text accessibilityRole="alert" style={styles.error}>
                            {fieldState.error.message}
                          </Text>
                        )}
                      </>
                    )}
                  />
                  <ControlledInput
                    control={control}
                    name={`items.${index}.minutes`}
                    label={`Thời lượng buổi ${session.sessionNo} (phút)`}
                    keyboardType="number-pad"
                    editable={!disabled}
                    reserveMessageSpace={false}
                  />
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
