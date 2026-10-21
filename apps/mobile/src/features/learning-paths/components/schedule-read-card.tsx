import { styles } from "./schedule-read-styles";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { FlowSection } from "@/components/learning-flow";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { appColors as colors } from "@/constants/theme";
import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";
import {
  ownConfirmation,
  scheduleStatusLabel,
  learningSessionLabel,
} from "../utils/policy-api";
import { agreementProgress } from "../utils/progression";
import { AgreementProgressPanel } from "./agreement-progress";
import { sessionContentParts } from "../utils/session-content";
import { ScheduleChatReminder } from "./schedule-chat-reminder";
import { ScheduleTimelineItem } from "./schedule-timeline-item";

export function ScheduleExchangeContext({
  path,
}: Readonly<{ path: ApiLearningPath }>) {
  const twoWay = path.agreement.exchangeType === "TWO_WAY";
  return (
    <View style={styles.exchange}>
      <View style={styles.exchangeIcon}>
        <Icon
          name={twoWay ? "users" : "book"}
          size={18}
          color={colors.primary}
        />
      </View>
      <View style={styles.exchangeText}>
        <Text style={styles.exchangeTitle}>
          {twoWay ? "Trao đổi hai chiều" : "Học một chiều"}
        </Text>
        <Text style={styles.secondary}>
          {twoWay
            ? "Hai lịch riêng: bạn dạy và bạn học. Mỗi lịch cần cả hai xác nhận."
            : "Một lịch cho lộ trình đã thống nhất. Cả hai cùng xác nhận lịch."}
        </Text>
      </View>
    </View>
  );
}

export function ScheduleTimezoneNotice() {
  return (
    <View style={styles.timezoneNotice}>
      <Icon name="clock" size={13} color={colors.muted} />
      <Text style={styles.timezoneNoticeText}>
        Giờ theo múi giờ thiết bị. Lịch cần cả hai xác nhận; buổi học và Credit
        chỉ được tạo, tạm giữ khi chốt lộ trình.
      </Text>
    </View>
  );
}

export function ScheduleListOverview({
  path,
  userId,
  blocked,
}: Readonly<{ path: ApiLearningPath; userId?: string; blocked: boolean }>) {
  const progress = agreementProgress(path, userId);
  if (!["schedules", "finalize"].includes(progress.stage))
    return (
      <AgreementProgressPanel
        path={path}
        blocked={blocked}
        current={`/paths/${path.id}/schedules`}
      />
    );
  const waiting = progress.waiting.length > 0;
  return (
    <View
      style={[
        styles.banner,
        waiting ? styles.bannerWaiting : styles.bannerReady,
      ]}
    >
      <Icon
        name={progress.stage === "finalize" ? "check-circle" : "clock"}
        size={22}
        color={waiting ? colors.amber : colors.forest}
      />
      <View style={styles.grow}>
        <Text style={styles.bannerTitle}>
          {progress.title.replace(/^Bước \d+ · /, "")}
        </Text>
        <Text style={styles.bannerText}>
          {progress.waiting.length
            ? progress.waiting.join(" ")
            : "Đã đủ xác nhận. Xem lại lịch trước khi kiểm tra và chốt."}
        </Text>
      </View>
    </View>
  );
}
export function ScheduleReadCard({
  path,
  plan,
  skill,
  userId,
  children,
  blocked = false,
}: Readonly<{
  path: ApiLearningPath;
  plan: ApiLearningPlan;
  skill: string;
  userId?: string;
  children: ReactNode;
  blocked?: boolean;
}>) {
  const schedule = plan.schedule;
  const mine = plan.teacherId === userId;
  const both =
    !!schedule?.participantAConfirmedAt && !!schedule?.participantBConfirmedAt;
  const confirmed =
    !!schedule &&
    (schedule.status === "LOCKED" ||
      (both && ["PROPOSED", "PARTIALLY_CONFIRMED"].includes(schedule.status)));
  const partnerConfirmed =
    path.participantAId === userId
      ? schedule?.participantBConfirmedAt
      : schedule?.participantAConfirmedAt;
  const scheduledCount = schedule?.items.length ?? plan.sessions.length;
  return (
    <FlowSection>
      <View style={styles.header}>
        <View style={styles.grow}>
          <Text accessibilityRole="header" style={styles.title}>
            {skill}
          </Text>
          <View style={styles.metadata}>
            <Text style={[styles.role, !mine && styles.learningRole]}>
              {mine ? "Bạn dạy" : "Bạn học"}
            </Text>
            <Text style={styles.secondary}>{plan.totalSessions} buổi</Text>
          </View>
        </View>
        <View
          style={[
            styles.status,
            confirmed && styles.successStatus,
            !schedule && styles.emptyStatus,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              confirmed && styles.successText,
              !schedule && styles.secondary,
            ]}
          >
            {schedule
              ? confirmed && schedule.status !== "LOCKED"
                ? "Đủ xác nhận"
                : scheduleStatusLabel[schedule.status]
              : "Chờ xếp lịch"}
          </Text>
        </View>
      </View>
      <Text style={styles.goal}>{plan.learningGoal}</Text>
      {plan.sessions.length > 0 ? (
        <View style={styles.list}>
          <View style={styles.listHeading}>
            <Text style={styles.listHeadingText}>Buổi học đã tạo</Text>
            <Text style={styles.listCount}>
              {plan.sessions.length} / {plan.totalSessions} buổi
            </Text>
          </View>
          {plan.sessions.map((session, index) => (
            <ScheduleTimelineItem
              key={session.id}
              last={index === plan.sessions.length - 1}
            >
              <ScheduleSlotRow
                slot={session}
                title={
                  sessionContentParts(
                    plan.sessionOutline.find(
                      (item) => item.sessionNo === session.sessionNo,
                    )?.content ?? "",
                  ).title
                }
                status={learningSessionLabel[session.status]}
              />
            </ScheduleTimelineItem>
          ))}
        </View>
      ) : schedule ? (
        <View style={styles.list}>
          <View style={styles.listHeading}>
            <Text style={styles.listHeadingText}>Lịch từng buổi</Text>
            <Text style={styles.listCount}>
              {scheduledCount} / {plan.totalSessions} buổi sẵn sàng
            </Text>
          </View>
          {schedule.items.map((slot, index) => (
            <ScheduleTimelineItem
              key={slot.sessionNo}
              last={index === schedule.items.length - 1}
            >
              <ScheduleSlotRow
                slot={slot}
                title={
                  sessionContentParts(
                    plan.sessionOutline.find(
                      (item) => item.sessionNo === slot.sessionNo,
                    )?.content ?? "",
                  ).title
                }
              />
            </ScheduleTimelineItem>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="calendar" size={26} color={colors.muted} />
          </View>
          <Text style={styles.emptyTitle}>Chưa có đề xuất lịch</Text>
          <Text style={styles.emptyText}>
            {mine
              ? "Chọn ngày giờ cho từng buổi trong lộ trình bạn dạy."
              : "Chờ đối tác đề xuất lịch họ dạy để hai bạn cùng xem và xác nhận."}
          </Text>
        </View>
      )}
      {schedule && (
        <View style={styles.confirmations}>
          <ScheduleConfirmation
            label="Bạn"
            confirmed={!!ownConfirmation(path, schedule, userId)}
          />
          <ScheduleConfirmation
            label="Đối tác"
            confirmed={!!partnerConfirmed}
          />
        </View>
      )}
      {children}
      {!schedule && !mine && (
        <ScheduleChatReminder
          conversationId={path.conversationId}
          blocked={blocked}
        />
      )}
    </FlowSection>
  );
}
export function ScheduleMissingPlanCard({
  path,
  mine,
  blocked,
}: Readonly<{
  path: ApiLearningPath;
  mine: boolean;
  blocked: boolean;
}>) {
  const router = useRouter();
  return (
    <FlowSection>
      <View style={styles.header}>
        <Text style={styles.title}>
          {mine ? "Lịch bạn dạy" : "Lịch bạn học"}
        </Text>
        <Text style={styles.secondary}>Chờ lộ trình</Text>
      </View>
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Icon name="calendar" size={26} color={colors.muted} />
        </View>
        <Text style={styles.emptyText}>
          {mine
            ? "Bạn chưa tạo lộ trình mình dạy."
            : "Đối tác chưa tạo lộ trình họ dạy."}
          {" Cần hoàn thành và xác nhận cả hai lộ trình trước khi xếp lịch."}
        </Text>
      </View>
      <Button
        variant="secondary"
        disabled={blocked}
        onPress={() => {
          if (!blocked) router.dismissTo(`/paths/${path.id}`);
        }}
      >
        Xem lộ trình
      </Button>
    </FlowSection>
  );
}
function ScheduleSlotRow({
  slot,
  title,
  status,
}: Readonly<{
  slot: { sessionNo: number; startAt: string; endAt: string };
  title: string;
  status?: string;
}>) {
  const start = new Date(slot.startAt),
    end = new Date(slot.endAt);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const timeOptions = { hour: "2-digit", minute: "2-digit" } as const;
  const endLabel =
    start.toDateString() === end.toDateString()
      ? end.toLocaleTimeString("vi-VN", timeOptions)
      : end.toLocaleString("vi-VN", {
          ...timeOptions,
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
  return (
    <View style={styles.slot}>
      <Text style={styles.slotTitle}>
        {`Buổi ${slot.sessionNo}${title.trim() ? ` · ${title.trim()}` : ""}`}
      </Text>
      <View style={styles.slotDetails}>
        <View style={styles.dateTile}>
          <Text style={styles.sessionNumber}>
            {start.toLocaleDateString("vi-VN", { weekday: "short" })}
          </Text>
          <Text style={styles.day}>{start.getDate()}</Text>
        </View>
        <View style={styles.grow}>
          <Text style={styles.date}>
            {`Tháng ${start.getMonth() + 1}, ${start.getFullYear()}`}
          </Text>
          <Text style={styles.secondary}>
            {start.toLocaleTimeString("vi-VN", timeOptions)} – {endLabel}
          </Text>
          {!!status && <Text style={styles.secondary}>{status}</Text>}
        </View>
        <Text style={styles.duration}>{minutes} phút</Text>
      </View>
    </View>
  );
}
function ScheduleConfirmation({
  label,
  confirmed,
}: Readonly<{ label: string; confirmed: boolean }>) {
  return (
    <View style={styles.confirmation}>
      <Text style={styles.secondary}>{label}</Text>
      <View style={styles.confirmationState}>
        <Icon
          name={confirmed ? "check-circle" : "clock"}
          size={14}
          color={confirmed ? colors.forest : colors.warning}
        />
        <Text
          style={[styles.confirmationText, confirmed && styles.successText]}
        >
          {confirmed ? "Đã xác nhận" : "Chưa xác nhận"}
        </Text>
      </View>
    </View>
  );
}
