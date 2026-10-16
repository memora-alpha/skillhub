import { Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { uiLabel } from "@/constants/ui-copy";
import type { RequestItem } from "../types";
import { RequestDetailSection } from "./request-detail-section";
import { isOwnRequest } from "../utils/request-policy";
import {
  requestDetailColors as colors,
  requestDetailStyles as styles,
} from "./request-detail.styles";

export function RequestExchangeDetails({
  request,
}: Readonly<{ request: RequestItem }>) {
  if (!request.teachingOverview && !request.offeredSharingSkills.length)
    return null;
  return (
    <RequestDetailSection
      title={isOwnRequest(request) ? "Tôi có thể dạy lại" : "Kỹ năng dạy lại"}
      icon="star"
      tone="forest"
    >
      {request.teachingOverview && (
        <View style={{ gap: 6 }}>
          <Text selectable style={styles.body}>
            {request.teachingOverview}
          </Text>
        </View>
      )}
      {!!request.offeredSharingSkills.length && (
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: colors.forest }]}>
            Kỹ năng chia sẻ
          </Text>
          <View style={styles.row}>
            {request.offeredSharingSkills.map((item) => (
              <View key={item.id} style={styles.offering}>
                <Text selectable style={styles.offeringName}>
                  {item.skill.name}
                </Text>
                <Text style={styles.caption}>
                  {item.skillLevel?.name ?? uiLabel(item.level)}
                </Text>
                {item.verificationStatus === "VERIFIED" && (
                  <View style={styles.verification}>
                    <Icon
                      name="check-circle"
                      size={14}
                      color={colors.success}
                    />
                    <Text
                      style={[
                        styles.caption,
                        { color: colors.success, flexShrink: 1 },
                      ]}
                    >
                      Đã xác minh
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </RequestDetailSection>
  );
}
