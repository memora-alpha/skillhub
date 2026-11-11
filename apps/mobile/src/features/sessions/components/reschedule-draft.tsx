import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Text, View } from "react-native";
import { ControlledInput } from "@/components/ControlledInput";
import { DateTimeField } from "@/components/DateTimeField";
import { FormNotice } from "@/components/FormNotice";
import { pickerValue } from "@/utils/date-choice";
import type { LearningSession } from "../types";
import type { RescheduleInput } from "../api/reschedule-api";
import { formatReportDeadline, sessionDuration } from "../utils/session-time";
import { sessionSchedule } from "../utils/session-schedule";
import { SessionSection, SessionInfoRow } from "./session-section";
import { SessionButton } from "./session-page";
import {
  isRescheduleEligible,
  rescheduleAvailabilityMessage,
  rescheduleFormSchema,
  rescheduleInput,
  type RescheduleForm,
} from "../utils/reschedule-form";
import { rescheduleStyles as styles } from "./reschedule.styles";

export function RescheduleDraft({
  session,
  timezone,
  expectedVersion,
  disabled,
  pending,
  hasPending = false,
  now = Date.now(),
  makeup = session.status === "MAKEUP_REQUIRED",
  applied = false,
  onSubmit,
}: Readonly<{
  session: LearningSession;
  timezone: string;
  expectedVersion?: number;
  disabled: boolean;
  pending: boolean;
  hasPending?: boolean;
  now?: number;
  makeup?: boolean;
  applied?: boolean;
  onSubmit: (input: RescheduleInput) => void;
}>) {
  const duration = sessionDuration(session);
  const schedule = sessionSchedule(session, timezone);
  const unavailable = disabled || !isRescheduleEligible(session, now);
  const submitLabel = makeup ? "Gửi lịch học bù" : "Gửi đề nghị";
  const { control, handleSubmit, setError } = useForm<RescheduleForm>({
    resolver: zodResolver(rescheduleFormSchema),
    defaultValues: { start: "", duration: String(duration) },
    mode: "onBlur",
  });
  const submit = handleSubmit((values) => {
    if (
      unavailable ||
      expectedVersion === undefined ||
      !isRescheduleEligible(session)
    )
      return;
    const input = rescheduleInput(values, expectedVersion);
    if (!input) {
      setError("start", {
        type: "validate",
        message: "Chọn ngày giờ mới trong tương lai.",
      });
      return;
    }
    onSubmit(input);
  });
  return (
    <>
      <SessionSection
        title={
          applied
            ? "Lịch học bù đã chốt"
            : makeup
              ? "Buổi cần học bù"
              : "Lịch hiện tại"
        }
        icon="calendar"
      >
        <SessionInfoRow label={schedule.date}>
          {schedule.time} · {duration} phút
        </SessionInfoRow>
        {makeup && !applied && session.deadlines?.makeupBy && (
          <Text selectable style={styles.secondary}>
            Chốt trước{" "}
            {formatReportDeadline(session.deadlines.makeupBy, timezone)}
          </Text>
        )}
      </SessionSection>
      {!hasPending && !applied && (
        <SessionSection
          title={makeup ? "Chọn lịch học bù" : "Chọn lịch mới"}
          icon="clock"
        >
          <Controller
            control={control}
            name="start"
            render={({ field, fieldState }) => (
              <View style={{ gap: 6 }}>
                <DateTimeField
                  label={makeup ? "Ngày giờ học bù" : "Ngày giờ mới"}
                  tabVariant="solid"
                  value={field.value}
                  seed={pickerValue(
                    new Date(Math.max(Date.parse(session.startAt), now)),
                  )}
                  disabled={unavailable}
                  onChange={(value) => {
                    field.onChange(value);
                    field.onBlur();
                  }}
                />
                {fieldState.error && (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {fieldState.error.message}
                  </Text>
                )}
              </View>
            )}
          />
          <ControlledInput
            control={control}
            name="duration"
            label="Thời lượng (phút)"
            keyboardType="number-pad"
            editable={!unavailable}
            hint="Từ 60 đến 180 phút."
          />
          <FormNotice compact tone="info">
            {rescheduleAvailabilityMessage(session, now)}
          </FormNotice>
          <SessionButton
            disabled={unavailable || expectedVersion === undefined}
            onPress={() => {
              void submit();
            }}
          >
            {pending ? "Đang xử lý…" : submitLabel}
          </SessionButton>
        </SessionSection>
      )}
    </>
  );
}
