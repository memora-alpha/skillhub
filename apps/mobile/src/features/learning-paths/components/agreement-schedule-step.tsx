import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { FlowSection } from "@/components/learning-flow";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { useCatalogName } from "@/features/connections";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import type {
  ApiLearningPath,
  ApiLearningPlan,
} from "../api/learning-paths-contract";
import { agreementProgress } from "../utils/progression";
import { scheduleDirections } from "../utils/schedule-directions";
import { ScheduleChatReminder } from "./schedule-chat-reminder";
import {
  ownConfirmation,
  scheduleStatusLabel,
  scheduleIsComplete,
} from "../utils/policy-api";
import { AgreementProgressPanel } from "./agreement-progress";
import {
  AgreementFooter,
  agreementFooterPrimaryStyle,
} from "./agreement-footer";

export function AgreementScheduleStep({
  path,
  userId,
  blocked,
  onReviewPlans,
}: Readonly<{
  path: ApiLearningPath;
  userId?: string;
  blocked: boolean;
  onReviewPlans: () => void;
}>) {
  const router = useRouter();
  const progress = agreementProgress(path, userId);
  if (!["schedules", "finalize"].includes(progress.stage))
    return (
      <AgreementProgressPanel
        path={path}
        blocked={blocked}
        current={`/paths/${path.id}`}
      />
    );
  const action = progress.action ?? {
    label: "Xem trạng thái lịch",
    href: `/paths/${path.id}/schedules` as const,
  };
  return (
    <>
      <FlowSection>
        <View style={styles.heading}>
          <View style={styles.titleRow}>
            <View style={styles.icon}>
              <Icon name="calendar" size={20} color={colors.primary} />
            </View>
            <Text accessibilityRole="header" style={styles.title}>
              {progress.title.replace(/^Bước \d+ · /, "")}
            </Text>
          </View>
          <Text style={styles.step}>
            {progress.stage === "finalize" ? "Chờ chốt" : "Bước 3"}
          </Text>
        </View>
        <Text style={styles.description}>
          {progress.stage === "finalize"
            ? "Hai bên đã xác nhận lịch. Kiểm tra và chốt để bắt đầu học."
            : "Hai bên xem và xác nhận cùng phiên bản lịch."}
        </Text>
        {path.agreement.exchangeType === "TWO_WAY" && (
          <Text style={styles.metadata}>
            Trao đổi hai chiều · Bạn dạy và bạn học có lịch riêng.
          </Text>
        )}
        {!!progress.waiting.length && (
          <View style={styles.waiting}>
            <Icon name="clock" size={18} color={colors.primary} />
            <View style={styles.waitingContent}>
              {progress.waiting.map((message) => (
                <Text key={message} style={styles.waitingText}>
                  {message}
                </Text>
              ))}
            </View>
          </View>
        )}
        <View style={styles.directions}>
          {scheduleDirections(path, userId).map(({ key, plan, mine }) => (
            <ScheduleDirection
              key={key}
              path={path}
              plan={plan}
              teaching={mine}
              userId={userId}
            />
          ))}
        </View>
        {scheduleDirections(path, userId).some(
          ({ mine, plan }) => !mine && plan && !plan.schedule,
        ) && (
          <ScheduleChatReminder
            conversationId={path.conversationId}
            blocked={blocked}
          />
        )}
        <View style={styles.note}>
          <Icon name="shield" size={16} color={colors.forest} />
          <Text style={styles.noteText}>
            Hệ thống kiểm tra lịch và số dư trước khi chốt, tạm giữ Credit và
            tạo buổi học.
          </Text>
        </View>
      </FlowSection>
      <AgreementFooter
        conversationId={path.conversationId}
        review={{ label: "Xem lại lộ trình", onPress: onReviewPlans }}
      >
        <Button
          style={agreementFooterPrimaryStyle}
          disabled={blocked}
          onPress={() => {
            if (!blocked) router.push(action.href);
          }}
        >
          {action.label}
        </Button>
      </AgreementFooter>
    </>
  );
}
function ScheduleDirection({
  path,
  plan,
  userId,
  teaching,
}: Readonly<{
  path: ApiLearningPath;
  plan?: ApiLearningPlan;
  userId?: string;
  teaching: boolean;
}>) {
  const skill = useCatalogName(plan?.skillId);
  const schedule = plan?.schedule;
  const confirmed =
    !!schedule &&
    !!schedule.participantAConfirmedAt &&
    !!schedule.participantBConfirmedAt;
  const ready =
    !!schedule &&
    ["PROPOSED", "PARTIALLY_CONFIRMED", "NEEDS_REVISION"].includes(
      schedule.status,
    ) &&
    !!plan &&
    scheduleIsComplete(plan);
  const mine = !!schedule && !!ownConfirmation(path, schedule, userId);
  const label = scheduleDirectionLabel({
    hasPlan: !!plan,
    hasSchedule: !!schedule,
    teaching,
    status: schedule?.status,
    ready,
    confirmed,
    mine,
  });
  const done =
    !!schedule && (schedule.status === "LOCKED" || (ready && confirmed));
  return (
    <View style={styles.direction}>
      <View style={styles.directionContent}>
        <Text style={styles.directionTitle}>
          {teaching ? "Lịch bạn dạy" : "Lịch bạn học"}
        </Text>
        <Text style={styles.skill}>
          {plan ? (skill.data ?? "Lộ trình học") : "Chưa có lộ trình"}
        </Text>
        <Text style={styles.metadata}>
          {plan
            ? `${plan.totalSessions} buổi`
            : "Hoàn thành lộ trình trước khi xếp lịch"}
          {schedule ? ` · Lịch bản ${schedule.version}` : ""}
        </Text>
      </View>
      <View style={[styles.badge, done && styles.doneBadge]}>
        <Icon
          name={done ? "check-circle" : "clock"}
          size={14}
          color={done ? colors.forest : colors.warning}
        />
        <Text style={[styles.badgeText, done && styles.doneText]}>{label}</Text>
      </View>
    </View>
  );
}

function scheduleDirectionLabel(input: {
  hasPlan: boolean;
  hasSchedule: boolean;
  teaching: boolean;
  status?: NonNullable<ApiLearningPlan["schedule"]>["status"];
  ready: boolean;
  confirmed: boolean;
  mine: boolean;
}) {
  if (!input.hasPlan) return "Chờ lộ trình";
  if (!input.hasSchedule)
    return input.teaching ? "Bạn cần xếp lịch" : "Chờ đối tác gửi lịch";
  if (input.status === "LOCKED") return "Đã chốt";
  if (!input.ready && input.status) return scheduleStatusLabel[input.status];
  if (input.confirmed) return "Đã xác nhận";
  if (input.mine) return "Chờ đối tác";
  return "Bạn cần xác nhận";
}
const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  titleRow: {
    flex: 1,
    minWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: appRadius.button,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    ...typography.heading,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  step: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: appRadius.badge,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  description: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.body,
  },
  waiting: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: appRadius.control,
    backgroundColor: colors.primarySoft,
  },
  waitingContent: { flex: 1, minWidth: 0, gap: 8 },
  waitingText: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.body,
  },
  directions: { gap: 10 },
  direction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
    padding: 12,
    borderRadius: appRadius.control,
    backgroundColor: colors.surfaceLow,
  },
  directionContent: { flex: 1, minWidth: 120, gap: 4 },
  directionTitle: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  skill: {
    ...typography.secondary,
    fontFamily: fonts.medium,
    color: colors.body,
  },
  metadata: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: appRadius.badge,
    backgroundColor: colors.amberSoft,
  },
  badgeText: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.warning,
  },
  doneBadge: { backgroundColor: colors.forestSoft },
  doneText: { color: colors.forest },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  noteText: {
    flex: 1,
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
});
