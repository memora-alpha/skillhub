import { Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { FormNotice } from "@/components/FormNotice";
import { RequestDetailSection as Panel } from "./request-detail-section";
import { RequestDetailSummary } from "./request-detail-summary";
import { RequestExchangeDetails } from "./request-exchange-details";
import { RequestScheduleDetails } from "./request-schedule-details";
import { RequestCreditDetails } from "./request-credit-details";
import { RequestRequesterDetails } from "./request-public-details";
import { isOwnRequest, requestState } from "../utils/request-policy";
import type { OwnerRequest, PublicRequestDetail } from "../types";
import {
  requestDetailColors as colors,
  requestDetailStyles as styles,
} from "./request-detail.styles";

export function RequestContent({
  request,
}: Readonly<{
  request: OwnerRequest | PublicRequestDetail;
}>) {
  const own = isOwnRequest(request);
  const state = requestState(request);
  return (
    <>
      <RequestDetailSummary request={request} />
      <Panel title={own ? "Tôi muốn học" : "Nhu cầu học tập"} icon="book">
        <Text selectable style={styles.body}>
          {request.description}
        </Text>
        <View
          style={[
            styles.inset,
            { flexDirection: "row", alignItems: "flex-start", gap: 10 },
          ]}
        >
          <Icon name="flag" size={18} color={colors.accent} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.label}>Mục tiêu kỳ vọng</Text>
            <Text selectable style={styles.emphasis}>
              {request.learningGoal}
            </Text>
          </View>
        </View>
      </Panel>
      <RequestExchangeDetails request={request} />
      <RequestScheduleDetails request={request} />
      <RequestCreditDetails request={request} />
      {!own && <RequestRequesterDetails owner={request.owner} />}
      {own &&
        request.moderationStatus === "REJECTED" &&
        request.moderationRejectReason && (
          <FormNotice tone="error">
            Lý do từ chối: {request.moderationRejectReason}
          </FormNotice>
        )}
      {state === "PENDING_MODERATION" && (
        <FormNotice tone="info">
          Bài đang chờ duyệt và chưa nhận đề xuất mới.
        </FormNotice>
      )}
      {state === "MATCHED" && (
        <FormNotice tone="info">
          Lịch học đã khóa. Để dừng hoặc đổi lịch, sử dụng luồng trong Learning
          Path đã liên kết.
        </FormNotice>
      )}
    </>
  );
}
