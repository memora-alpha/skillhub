import { Text, View } from "react-native";
import { dateLabel } from "../utils/request-policy";
import { groupRequestSchedule } from "../utils/request-schedule-groups";
import { requestTimeZoneNote } from "../utils/request-time-zone";
import type { RequestItem } from "../types";
import { RequestDetailSection } from "./request-detail-section";
import { requestDetailStyles as styles } from "./request-detail.styles";

export function RequestScheduleDetails({
  request,
}: Readonly<{ request: RequestItem }>) {
  const availability = request.preferredAvailability;
  return (
    <>
      {!!availability?.weeklySlots.length && (
        <RequestDetailSection title="Lịch rảnh" icon="calendar" tone="amber">
          <Text style={styles.caption}>
            {requestTimeZoneNote(availability.timeZone)}
          </Text>
          {groupRequestSchedule(availability.weeklySlots).map((group) => (
            <View key={group.weekday} style={styles.scheduleRow}>
              <Text style={[styles.emphasis, styles.dayLabel]}>
                {group.label}
              </Text>
              <View style={styles.timeChoices}>
                {group.slots.map((slot) => (
                  <View
                    key={`${slot.startTime}-${slot.endTime}`}
                    style={styles.timeChip}
                  >
                    <Text selectable style={styles.timeText}>
                      {slot.startTime} – {slot.endTime}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
          <View style={styles.meta}>
            <Text style={styles.caption}>
              Lặp hằng tuần · Thời gian ưu tiên, chưa chốt lịch học.
            </Text>
          </View>
        </RequestDetailSection>
      )}
      {!!request.preferredSlots.length && (
        <RequestDetailSection title="Khoảng ngày đã lưu" icon="calendar">
          <Text style={styles.caption}>
            Giờ theo thiết bị · Chưa chốt lịch học
          </Text>
          {request.preferredSlots.map((slot, index) => (
            <View key={`${slot.startAt}-${index}`} style={styles.inset}>
              <Text selectable style={styles.emphasis}>
                {dateLabel(slot.startAt)} → {dateLabel(slot.endAt)}
              </Text>
            </View>
          ))}
        </RequestDetailSection>
      )}
    </>
  );
}
