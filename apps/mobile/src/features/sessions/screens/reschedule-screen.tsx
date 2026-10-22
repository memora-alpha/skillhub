import { useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Text, View } from "react-native";
import { ControlledInput } from "@/components/ControlledInput";
import { DateTimeField } from "@/components/DateTimeField";
import { KeyboardFormScrollView } from "@/components/KeyboardFormScrollView";
import { Icon } from "@/components/Icon";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { AppScreenLayout } from "@/features/shell";
import { appColors as colors } from "@/constants/theme";
import { pickerValue } from "@/utils/date-choice";
import { useSessionDetail } from "../hooks/use-sessions";
import { SessionFeedback } from "../components/session-feedback";
import { RescheduleProposalPanel } from "../components/reschedule-proposal-panel";
import { rescheduleStyles as styles } from "../components/reschedule.styles";
import {
  deviceTimezone,
  formatSessionTime,
  sessionDuration,
} from "../utils/session-time";
import {
  rescheduleUnavailableMessage,
  rescheduleFormSchema,
  type RescheduleForm,
} from "../utils/reschedule-form";

export function RescheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useSessionDetail(id),
    session = query.data;
  return (
    <AppScreenLayout
      title="Đề nghị đổi lịch"
      selected="Lịch học"
      back={{ href: "/calendar", label: "Quay lại", behavior: "history" }}
      contentStyle={styles.background}
    >
      {() => (
        <KeyboardFormScrollView contentContainerStyle={styles.page}>
          <SessionFeedback
            {...query}
            invalid={!query.valid}
            refreshing={query.isFetching}
            retry={() => query.refetch()}
          >
            {session && (
              <RescheduleDraft
                key={session.id}
                startAt={session.startAt}
                duration={sessionDuration(session)}
                status={session.status}
                timezone={deviceTimezone()}
              />
            )}
            {session && (
              <RescheduleProposalPanel
                session={session}
                timezone={deviceTimezone()}
              />
            )}
          </SessionFeedback>
        </KeyboardFormScrollView>
      )}
    </AppScreenLayout>
  );
}

function RescheduleDraft({
  startAt,
  duration,
  status,
  timezone,
}: {
  startAt: string;
  duration: number;
  status: string;
  timezone: string;
}) {
  const { control } = useForm<RescheduleForm>({
    resolver: zodResolver(rescheduleFormSchema),
    defaultValues: { start: "", duration: String(duration) },
    mode: "onBlur",
  });
  const unavailableMessage = rescheduleUnavailableMessage({ startAt, status });
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
              {formatSessionTime(startAt, timezone)}
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
                seed={pickerValue(new Date(startAt))}
                disabled={false}
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
          hint="Từ 60 đến 180 phút."
        />
        <FormNotice tone="info">{unavailableMessage}</FormNotice>
        <Button
          variant="craft"
          style={styles.action}
          accessibilityLabel="Gửi đề nghị — chưa khả dụng"
          disabled
          onPress={() => {}}
        >
          <Text style={styles.actionLabel}>Gửi đề nghị — chưa khả dụng</Text>
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
