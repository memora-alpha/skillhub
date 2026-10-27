import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Text, View } from "react-native";
import { ControlledInput } from "@/components/ControlledInput";
import { DateTimeField } from "@/components/DateTimeField";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { appColors as colors } from "@/constants/theme";
import { pickerValue } from "@/utils/date-choice";
import type { LearningSession } from "../types";
import type { RescheduleInput } from "../api/reschedule-api";
import { formatSessionTime, sessionDuration } from "../utils/session-time";
import {
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
  onSubmit,
}: Readonly<{
  session: LearningSession;
  timezone: string;
  expectedVersion?: number;
  disabled: boolean;
  pending: boolean;
  onSubmit: (input: RescheduleInput) => void;
}>) {
  const duration = sessionDuration(session);
  const { control, handleSubmit, setError } = useForm<RescheduleForm>({
    resolver: zodResolver(rescheduleFormSchema),
    defaultValues: { start: "", duration: String(duration) },
    mode: "onBlur",
  });
  const submit = handleSubmit((values) => {
    if (disabled || expectedVersion === undefined) return;
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
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>
          Lịch hiện tại
        </Text>
        <View style={styles.current}>
          <View style={styles.icon}>
            <Icon name="calendar" color={colors.primary} size={20} />
          </View>
          <View style={styles.grow}>
            <Text selectable style={styles.body}>
              {formatSessionTime(session.startAt, timezone)}
            </Text>
            <Text style={styles.secondary}>{duration} phút</Text>
          </View>
        </View>
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>
          Chọn lịch mới
        </Text>
        <Controller
          control={control}
          name="start"
          render={({ field, fieldState }) => (
            <View style={{ gap: 6 }}>
              <DateTimeField
                label="Ngày giờ mới"
                tabVariant="solid"
                value={field.value}
                seed={pickerValue(new Date(session.startAt))}
                disabled={pending}
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
          editable={!pending}
          hint="Từ 60 đến 180 phút."
        />
        <FormNotice tone="info">
          {rescheduleAvailabilityMessage(session)}
        </FormNotice>
        <Button
          variant="craft"
          style={styles.action}
          accessibilityLabel={pending ? "Đang xử lý đổi lịch" : "Gửi đề nghị"}
          disabled={disabled || expectedVersion === undefined}
          onPress={() => {
            void submit();
          }}
        >
          <Text style={styles.actionLabel}>
            {pending ? "Đang xử lý…" : "Gửi đề nghị"}
          </Text>
        </Button>
      </View>
      <View style={styles.current}>
        <Icon name="shield" size={18} color={colors.warning} />
        <View style={styles.grow}>
          <Text accessibilityRole="header" style={styles.secondary}>
            Giữ lịch cũ đến khi chốt lịch mới
          </Text>
          <Text style={styles.secondary}>
            Hai bên cần xác nhận cùng lịch mới trước giờ bắt đầu lịch cũ ít nhất
            60 phút. Lịch cũ vẫn có hiệu lực khi chưa đủ xác nhận.
          </Text>
        </View>
      </View>
    </>
  );
}
