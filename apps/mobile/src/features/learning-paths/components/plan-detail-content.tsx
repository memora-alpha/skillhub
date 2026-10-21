import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { FlowSection } from "@/components/learning-flow";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import type { ApiLearningPlan } from "../api/learning-paths-contract";
import { learningSessionLabel } from "../utils/policy-api";
import { sessionContentParts } from "../utils/session-content";
import { planDetailStyles } from "./plan-detail-styles";
import { ScheduleTimelineItem } from "./schedule-timeline-item";

export function PlanDetailContent({
  plan,
  skill,
  mine,
}: Readonly<{
  plan: ApiLearningPlan;
  skill: string;
  mine: boolean;
}>) {
  const confirmed = !!plan.learnerConfirmedAt;
  return (
    <View style={planDetailStyles.content}>
      <FlowSection compact>
        <View style={planDetailStyles.topline}>
          <Text style={planDetailStyles.eyebrow}>LỘ TRÌNH KỸ NĂNG</Text>
          <Text style={planDetailStyles.count}>{plan.totalSessions} buổi</Text>
        </View>
        <Text accessibilityRole="header" style={planDetailStyles.title}>
          {skill} · Bản {plan.version}
        </Text>
        <View style={planDetailStyles.roles}>
          <View style={planDetailStyles.role}>
            <View
              style={[
                planDetailStyles.roleAvatar,
                planDetailStyles.roleAvatarMine,
              ]}
            >
              <Icon name="user" size={14} color={colors.primaryDark} />
            </View>
            <View style={planDetailStyles.roleCopy}>
              <Text style={planDetailStyles.roleCaption}>
                {mine ? "BÊN DẠY" : "BÊN HỌC"}
              </Text>
              <Text style={planDetailStyles.roleText}>
                {mine ? "Bạn dạy" : "Bạn học"}
              </Text>
            </View>
          </View>
          <View style={planDetailStyles.exchange}>
            <Text style={planDetailStyles.exchangeText}>HỌC CÙNG</Text>
            <Icon name="arrow" size={15} color={colors.primary} />
          </View>
          <View style={[planDetailStyles.role, planDetailStyles.rolePartner]}>
            <View
              style={[
                planDetailStyles.roleAvatar,
                planDetailStyles.roleAvatarPartner,
              ]}
            >
              <Icon name="user" size={14} color={colors.forest} />
            </View>
            <View
              style={[
                planDetailStyles.roleCopy,
                planDetailStyles.roleCopyRight,
              ]}
            >
              <Text style={planDetailStyles.roleCaption}>
                {mine ? "BÊN HỌC" : "BÊN DẠY"}
              </Text>
              <Text style={planDetailStyles.roleText}>
                {mine ? "Đối tác học" : "Đối tác dạy"}
              </Text>
            </View>
          </View>
        </View>
        <View style={planDetailStyles.divider} />
        <View style={planDetailStyles.goalSection}>
          <View style={planDetailStyles.sectionHeading}>
            <Icon name="clipboard" size={14} color={colors.primary} />
            <Text style={planDetailStyles.sectionLabel}>
              MỤC TIÊU & GHI CHÚ THỎA THUẬN
            </Text>
          </View>
          <Text selectable style={planDetailStyles.goal}>
            {plan.learningGoal}
          </Text>
        </View>
      </FlowSection>

      <View style={planDetailStyles.timelineHeading}>
        <View style={planDetailStyles.timelineTitleWrap}>
          <View style={planDetailStyles.headingDot} />
          <Text
            accessibilityRole="header"
            style={planDetailStyles.timelineTitle}
          >
            Lộ trình học
          </Text>
        </View>
        <Text style={planDetailStyles.stopCount}>
          {plan.sessionOutline.length} buổi học
        </Text>
      </View>
      <View style={planDetailStyles.timelineList}>
        {plan.sessionOutline.map((session, index) => {
          const { title, description } = sessionContentParts(session.content);
          const scheduled =
            plan.schedule?.items.find(
              (item) => item.sessionNo === session.sessionNo,
            ) ??
            plan.sessions.find((item) => item.sessionNo === session.sessionNo);
          const duration = scheduled
            ? Math.round(
                (Date.parse(scheduled.endAt) - Date.parse(scheduled.startAt)) /
                  60000,
              )
            : 0;
          const actualSession = plan.sessions.find(
            (item) => item.sessionNo === session.sessionNo,
          );
          const isOngoing = actualSession?.status === "ONGOING";
          return (
            <ScheduleTimelineItem
              key={session.sessionNo}
              last={index === plan.sessionOutline.length - 1}
            >
              <View
                style={[
                  planDetailStyles.stopCard,
                  isOngoing && planDetailStyles.stopCardActive,
                ]}
              >
                <View style={planDetailStyles.stopTopline}>
                  <Text
                    style={[
                      planDetailStyles.stopLabel,
                      isOngoing && planDetailStyles.stopLabelActive,
                    ]}
                  >
                    {isOngoing
                      ? `ĐANG HỌC · BUỔI ${session.sessionNo}`
                      : `BUỔI ${session.sessionNo}`}
                  </Text>
                  {duration > 0 && Number.isFinite(duration) && (
                    <View style={planDetailStyles.duration}>
                      <Icon name="clock" size={12} color={colors.muted} />
                      <Text style={planDetailStyles.durationText}>
                        {duration} phút
                      </Text>
                    </View>
                  )}
                </View>
                <Text selectable style={planDetailStyles.sessionTitle}>
                  {title}
                </Text>
                {!!description && (
                  <Text selectable style={planDetailStyles.sessionDescription}>
                    {description}
                  </Text>
                )}
                {actualSession && (
                  <View style={planDetailStyles.sessionState}>
                    <Text
                      style={[
                        planDetailStyles.sessionStateText,
                        actualSession.status === "COMPLETED" &&
                          planDetailStyles.sessionStateComplete,
                        isOngoing && planDetailStyles.sessionStateActive,
                      ]}
                    >
                      {learningSessionLabel[actualSession.status]}
                    </Text>
                  </View>
                )}
              </View>
            </ScheduleTimelineItem>
          );
        })}
      </View>

      <View
        style={[
          planDetailStyles.confirmation,
          confirmed && planDetailStyles.confirmationOk,
        ]}
      >
        <View
          style={[
            planDetailStyles.confirmationIcon,
            confirmed && planDetailStyles.confirmationIconOk,
          ]}
        >
          <Icon
            name={confirmed ? "check-circle" : "clock"}
            size={16}
            color={confirmed ? colors.forest : colors.warning}
          />
        </View>
        <Text
          style={[
            planDetailStyles.confirmationText,
            confirmed && planDetailStyles.confirmationTextOk,
          ]}
        >
          {confirmed
            ? "Người học đã xác nhận phiên bản này."
            : plan.status === "DRAFT"
              ? mine
                ? "Bản nháp chưa được gửi cho người học."
                : "Lộ trình chưa được gửi để bạn xác nhận."
              : plan.status === "NEEDS_REVISION"
                ? mine
                  ? "Người học đề nghị chỉnh sửa phiên bản này."
                  : "Lộ trình cần được người dạy chỉnh sửa."
                : mine
                  ? "Đã gửi lộ trình, chờ người học xác nhận."
                  : "Xem nội dung từng buổi trước khi xác nhận."}
        </Text>
      </View>
    </View>
  );
}

export function PlanShareCard({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <FlowSection>
      <View style={planDetailStyles.shareHeading}>
        <Icon name="message" size={18} color={colors.primary} />
        <Text accessibilityRole="header" style={planDetailStyles.shareTitle}>
          Gửi cho người học
        </Text>
      </View>
      <Text style={planDetailStyles.shareDescription}>
        Chia sẻ lộ trình trong cuộc trò chuyện để đối tác đọc và xác nhận.
      </Text>
      {children}
    </FlowSection>
  );
}
