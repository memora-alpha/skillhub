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
import {
  ownConfirmation,
  scheduleStatusLabel,
  scheduleIsComplete,
} from "../utils/policy-api";
import { AgreementProgressPanel } from "./agreement-progress";

function scheduleHeading(stage: string) {
  if (stage === "sessions")
    return {
      title: "Lịch đã chốt",
      description: "Mở buổi học để xem lịch chi tiết và tham gia.",
    };
  if (stage === "finalize")
    return {
      title: "Sẵn sàng chốt lịch",
      description: "Hai bên đã xác nhận lịch. Kiểm tra và chốt để bắt đầu học.",
    };
  return {
    title: "Lịch học của hai bạn",
    description: "Người dạy đề xuất lịch, cả hai cùng xem và xác nhận.",
  };
}

export function AgreementScheduleStep({
  path,
  userId,
  blocked,
}: Readonly<{
  path: ApiLearningPath;
  userId?: string;
  blocked: boolean;
}>) {
  const router = useRouter();
  const progress = agreementProgress(path, userId);
  const directions = scheduleDirections(path, userId);
  const heading = scheduleHeading(progress.stage);
  if (!["schedules", "finalize", "sessions"].includes(progress.stage))
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
              {heading.title}
            </Text>
          </View>
        </View>
        <Text style={styles.description}>{heading.description}</Text>
        <View style={styles.directions}>
          {directions
            .filter(
              ({ plan }) =>
                progress.stage !== "sessions" ||
                plan?.schedule ||
                plan?.sessions.length,
            )
            .map(({ key, plan, mine }) => (
              <ScheduleDirection
                key={key}
                path={path}
                plan={plan}
                teaching={mine}
                userId={userId}
              />
            ))}
        </View>
        <Button
          style={styles.primary}
          disabled={blocked && progress.stage !== "sessions"}
          onPress={() => {
            if (!blocked || progress.stage === "sessions")
              router.push(action.href);
          }}
        >
          {action.label}
        </Button>
      </FlowSection>
      <Button
        variant="ghost"
        leadingIcon="message"
        accessibilityLabel="Trao đổi qua chat"
        onPress={() =>
          router.dismissTo({
            pathname: "/chat/[proposalId]",
            params: { proposalId: path.conversationId, mode: "api" },
          })
        }
      >
        Trao đổi qua chat
      </Button>
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
  const label = plan?.sessions.length
    ? "Đã chốt"
    : scheduleDirectionLabel({
        hasPlan: !!plan,
        hasSchedule: !!schedule,
        teaching,
        status: schedule?.status,
        ready,
        confirmed,
        mine,
      });
  const done =
    !!plan?.sessions.length ||
    (!!schedule && (schedule.status === "LOCKED" || (ready && confirmed)));
  const slots = plan?.sessions.length ? plan.sessions : schedule?.items;
  const first = slots?.reduce<(typeof slots)[number] | undefined>(
    (earliest, slot) =>
      !earliest || Date.parse(slot.startAt) < Date.parse(earliest.startAt)
        ? slot
        : earliest,
    undefined,
  );
  return (
    <View style={styles.direction}>
      <View style={styles.directionHeading}>
        <Text style={styles.directionTitle}>
          {teaching ? "Lịch bạn dạy" : "Lịch bạn học"}
        </Text>
        <View style={[styles.badge, done && styles.doneBadge]}>
          <Icon
            name={done ? "check-circle" : "clock"}
            size={14}
            color={done ? colors.forest : colors.warning}
          />
          <Text style={[styles.badgeText, done && styles.doneText]}>
            {label}
          </Text>
        </View>
      </View>
      <Text style={styles.skill}>
        {plan ? (skill.data ?? "Lộ trình học") : "Chưa có lộ trình"}
      </Text>
      <Text style={styles.metadata}>
        {plan
          ? `${plan.totalSessions} buổi`
          : "Hoàn thành lộ trình trước khi xếp lịch"}
        {first &&
          ` · Bắt đầu ${new Date(first.startAt).toLocaleString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}`}
      </Text>
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
  description: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.body,
  },
  primary: { minHeight: 48, borderRadius: appRadius.control, marginTop: 4 },
  directions: { gap: 0 },
  direction: {
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  directionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  directionTitle: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  skill: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  metadata: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  badge: {
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: appRadius.badge,
    backgroundColor: colors.amberSoft,
  },
  badgeText: {
    flexShrink: 1,
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.warning,
  },
  doneBadge: { backgroundColor: colors.forestSoft },
  doneText: { color: colors.forest },
});
