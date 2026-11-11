import { Text, View } from "react-native";
import { FormNotice } from "@/components/FormNotice";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import type { rescheduleSnapshot } from "../utils/reschedule-snapshot";
import { sessionSchedule } from "../utils/session-schedule";
import { SessionCopy, SessionButton } from "./session-page";
import { SessionSection, SessionInfoRow } from "./session-section";
import { rescheduleStyles as styles } from "./reschedule.styles";

type Snapshot = ReturnType<typeof rescheduleSnapshot>;

export function RescheduleProposalPanel({
  snapshot,
  timezone,
  loading,
  error,
  disabled,
  pending,
  makeup = false,
  unavailableMessage,
  onConfirm,
}: Readonly<{
  snapshot: Snapshot;
  timezone: string;
  loading: boolean;
  error: unknown;
  disabled: boolean;
  pending: boolean;
  makeup?: boolean;
  unavailableMessage?: string;
  onConfirm: () => void;
}>) {
  if (!snapshot?.hasPending)
    return error ? (
      <FormNotice compact tone="error">
        Chưa cập nhật được lịch học. Kéo xuống để thử lại.
      </FormNotice>
    ) : null;
  const schedule = snapshot?.pending
    ? sessionSchedule(snapshot.item, timezone)
    : undefined;
  const confirmationLabel = makeup
    ? "Xác nhận lịch học bù"
    : "Xác nhận lịch mới";
  return (
    <SessionSection
      title={makeup ? "Lịch học bù đề xuất" : "Lịch đề xuất"}
      icon="calendar"
    >
      {schedule && snapshot && (
        <>
          <SessionInfoRow label={schedule.date}>{schedule.time}</SessionInfoRow>
          <View style={styles.confirmations}>
            {(
              [
                ["Bạn", snapshot.ownConfirmed],
                ["Đối tác", snapshot.partnerConfirmed],
              ] as const
            ).map(([label, confirmed]) => (
              <View key={label} style={styles.confirmationRow}>
                <Icon
                  name={confirmed ? "check-circle" : "clock"}
                  size={16}
                  color={confirmed ? colors.forest : colors.muted}
                />
                <Text style={styles.secondary}>
                  {label} · {confirmed ? "Đã xác nhận" : "Chờ xác nhận"}
                </Text>
              </View>
            ))}
          </View>
          <SessionCopy muted>
            {snapshot.ownConfirmed && snapshot.partnerConfirmed
              ? "Cả hai đã xác nhận. Đang cập nhật lịch."
              : makeup
                ? "Cả hai cần xác nhận lịch học bù trước hạn."
                : "Cả hai cần xác nhận trước giờ học cũ ít nhất 60 phút."}
          </SessionCopy>
        </>
      )}
      {!schedule && !error && (
        <SessionCopy muted>
          {loading
            ? "Đang tải lịch đề xuất…"
            : "Một buổi khác đang có lịch chờ xác nhận. Chốt lịch buổi đó trước khi gửi lịch mới."}
        </SessionCopy>
      )}
      {!!error && (
        <FormNotice compact tone="error">
          Chưa cập nhật được lịch đề xuất. Kéo xuống để thử lại.
        </FormNotice>
      )}
      {unavailableMessage && (
        <FormNotice compact tone="info">
          {unavailableMessage}
        </FormNotice>
      )}
      {snapshot?.pending && !snapshot.ownConfirmed && (
        <SessionButton disabled={disabled || pending} onPress={onConfirm}>
          {pending ? "Đang xử lý…" : confirmationLabel}
        </SessionButton>
      )}
    </SessionSection>
  );
}
