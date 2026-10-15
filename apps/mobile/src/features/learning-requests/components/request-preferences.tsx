import { View } from "react-native";
import { Copy } from "@/components/feature-page";
import { Badge } from "@/components/Badge";
import { uiLabel } from "@/constants/ui-copy";
import { weekdayLabels, weekdays } from "../utils/request-weekly-slots";
import type { RequestItem } from "../types";
import { RequestSection } from "./request-section";

export function RequestPreferences({
  request,
  compact = false,
}: Readonly<{
  request: RequestItem;
  compact?: boolean;
}>) {
  const availability = request.preferredAvailability;
  const body = (
    <View style={{ gap: 8 }}>
      {request.teachingOverview && (
        <Copy>
          Có thể dạy:{" "}
          {compact && request.teachingOverview.length > 120
            ? `${request.teachingOverview.slice(0, 120)}…`
            : request.teachingOverview}
        </Copy>
      )}
      {!!request.offeredSharingSkills.length && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {request.offeredSharingSkills.map((item) => (
            <Badge
              key={item.id}
              label={`${item.skill.name} · ${item.skillLevel?.name ?? uiLabel(item.level)}${item.verificationStatus === "VERIFIED" ? " · Đã xác minh" : ""}`}
            />
          ))}
        </View>
      )}
      {request.desiredCreditPerHour && (
        <Copy>Mong muốn: {request.desiredCreditPerHour} CR/giờ</Copy>
      )}
      {!!availability?.weeklySlots.length && (
        <>
          <Copy muted>Lịch rảnh · {availability.timeZone}</Copy>
          {(compact
            ? availability.weeklySlots.slice(0, 2)
            : availability.weeklySlots
          ).map((slot) => (
            <Copy key={`${slot.weekday}:${slot.startTime}:${slot.endTime}`}>
              {weekdayLabels[weekdays.indexOf(slot.weekday)]} · {slot.startTime}
              –{slot.endTime}
            </Copy>
          ))}
          {compact && availability.weeklySlots.length > 2 && (
            <Copy muted>+{availability.weeklySlots.length - 2} khoảng giờ</Copy>
          )}
        </>
      )}
    </View>
  );
  if (
    !request.teachingOverview &&
    !request.offeredSharingSkills.length &&
    !request.desiredCreditPerHour &&
    !availability?.weeklySlots.length
  )
    return null;
  return compact ? (
    body
  ) : (
    <RequestSection title="Trao đổi và thời gian ưu tiên">
      {body}
    </RequestSection>
  );
}
