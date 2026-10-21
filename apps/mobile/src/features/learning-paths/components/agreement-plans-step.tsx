import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import {
  AgreementFooter,
  agreementFooterPrimaryStyle,
} from "./agreement-footer";
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
import { canCreatePlan, canEditPlan } from "../utils/policy-api";

export function AgreementPlansStep({
  path,
  userId,
  partnerName,
  blocked,
  canContinue,
  onReviewMethod,
  onContinue,
}: Readonly<{
  path: ApiLearningPath;
  userId?: string;
  partnerName: string;
  blocked: boolean;
  canContinue: boolean;
  onReviewMethod: () => void;
  onContinue: () => void;
}>) {
  const twoWay = path.agreement.exchangeType === "TWO_WAY";
  const partnerId =
    path.participantAId === userId ? path.participantBId : path.participantAId;
  const teachers = twoWay ? [partnerId, userId] : [path.agreement.teacherId];
  return (
    <>
      <View style={styles.guide}>
        <Icon name="users" size={22} color={colors.primary} />
        <Text style={styles.guideText}>
          {twoWay
            ? "Mỗi người tạo lộ trình mình dạy. Hai bạn có thể chuẩn bị và chỉnh sửa cùng lúc."
            : "Người dạy tạo lộ trình, người học xem chi tiết và xác nhận trước khi xếp lịch."}
        </Text>
      </View>
      {teachers
        .filter((id): id is string => !!id)
        .map((teacherId) => (
          <PlanDirectionCard
            key={teacherId}
            path={path}
            plan={path.plans.find((plan) => plan.teacherId === teacherId)}
            mine={teacherId === userId}
            partnerName={partnerName}
            canCreate={teacherId === userId && canCreatePlan(path, userId)}
            canEdit={
              !!path.plans.find(
                (plan) =>
                  plan.teacherId === teacherId &&
                  canEditPlan(path, plan, userId),
              )
            }
            blocked={blocked}
          />
        ))}
      <View style={styles.reminder}>
        <Icon name="shield" size={16} color={colors.muted} />
        <Text style={styles.reminderText}>
          Lộ trình cần người học xác nhận. Credit chỉ tạm giữ khi hai bên chốt
          lịch.
        </Text>
      </View>
      <AgreementFooter
        conversationId={path.conversationId}
        review={{ label: "Xem lại cách học", onPress: onReviewMethod }}
      >
        {canContinue && (
          <Button
            style={agreementFooterPrimaryStyle}
            disabled={blocked}
            onPress={onContinue}
          >
            Tiếp tục: Lịch học
          </Button>
        )}
      </AgreementFooter>
    </>
  );
}
function PlanDirectionCard({
  path,
  plan,
  mine,
  partnerName,
  canCreate,
  canEdit,
  blocked,
}: Readonly<{
  path: ApiLearningPath;
  plan?: ApiLearningPlan;
  mine: boolean;
  partnerName: string;
  canCreate: boolean;
  canEdit: boolean;
  blocked: boolean;
}>) {
  const router = useRouter();
  const skill = useCatalogName(plan?.skillId);
  const confirmed = !!plan?.learnerConfirmedAt;
  const needsAction = canCreate || (!!plan && !mine && !confirmed);
  const status = plan
    ? confirmed
      ? "Đã xác nhận"
      : mine
        ? "Chờ người học"
        : "Bạn cần xác nhận"
    : mine && canCreate
      ? "Phần việc của bạn"
      : mine
        ? "Chưa có lộ trình"
        : "Chờ đối tác tạo";
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.identity}>
          <Text style={[styles.direction, !mine && styles.learningDirection]}>
            {mine ? "Bạn dạy" : "Bạn học"}
          </Text>
          <Text style={styles.partner}>
            {mine ? "Học viên" : "Người dạy"}: {partnerName}
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            confirmed && styles.confirmedBadge,
            needsAction && styles.actionBadge,
          ]}
        >
          <Icon
            name={confirmed ? "check-circle" : "clock"}
            size={12}
            color={confirmed ? colors.forest : colors.warning}
          />
          <Text style={[styles.badgeText, confirmed && styles.confirmedText]}>
            {status}
          </Text>
        </View>
      </View>
      {plan ? (
        <>
          <Text numberOfLines={3} style={styles.goal}>
            {plan.learningGoal}
          </Text>
          <View style={styles.metadata}>
            <Text style={[styles.skill, !mine && styles.learningSkill]}>
              {skill.data ?? "Lộ trình học"}
            </Text>
            <View style={styles.sessionCount}>
              <Icon name="calendar" size={12} color={colors.muted} />
              <Text style={styles.secondary}>{plan.totalSessions} buổi</Text>
            </View>
            <Text style={styles.secondary}>· Bản {plan.version}</Text>
          </View>
          {confirmed && (
            <View style={styles.confirmation}>
              <Icon name="check-circle" size={14} color={colors.forest} />
              <Text style={styles.confirmationText}>
                Người học đã xác nhận lộ trình này
              </Text>
            </View>
          )}
          <View style={styles.actions}>
            <Button
              size="sm"
              variant={!mine && !confirmed ? "craft" : "secondary"}
              style={styles.action}
              onPress={() => router.push(`/paths/${path.id}/plans/${plan.id}`)}
            >
              {!mine && !confirmed
                ? "Xem và xác nhận lộ trình"
                : "Xem chi tiết"}
            </Button>
            {canEdit && (
              <Button
                size="sm"
                variant="paper"
                leadingIcon="edit"
                disabled={blocked}
                style={styles.action}
                onPress={() => {
                  if (!blocked)
                    router.push(`/paths/${path.id}/plans/${plan.id}/edit`);
                }}
              >
                Chỉnh sửa
              </Button>
            )}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.goal}>
            {mine ? "Thiết kế lộ trình bạn dạy" : "Chờ đối tác lên lộ trình"}
          </Text>
          <Text style={styles.secondary}>
            {mine
              ? "Thêm mục tiêu và nội dung cho từng buổi học."
              : `${partnerName} sẽ chuẩn bị nội dung cho chiều bạn học.`}
          </Text>
          {canCreate && (
            <Button
              size="sm"
              disabled={blocked}
              onPress={() => {
                if (!blocked) router.push(`/paths/${path.id}/plans/new`);
              }}
            >
              Tạo lộ trình bạn dạy
            </Button>
          )}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  guide: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    borderRadius: appRadius.control,
  },
  guideText: {
    flex: 1,
    ...typography.body,
    fontFamily: fonts.body,
    color: colors.body,
  },
  card: {
    padding: 14,
    gap: 10,
    borderRadius: appRadius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  identity: {
    flex: 1,
    minWidth: 120,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  direction: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  learningDirection: { color: colors.forest },
  partner: {
    ...typography.caption,
    fontFamily: fonts.body,
    color: colors.muted,
    flexShrink: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: appRadius.badge,
    backgroundColor: colors.amberSoft,
  },
  confirmedBadge: {
    backgroundColor: colors.forestSoft,
    borderColor: colors.forestMuted,
  },
  actionBadge: { borderColor: colors.primaryMuted },
  badgeText: {
    ...typography.caption,
    fontFamily: fonts.semibold,
    color: colors.warning,
  },
  confirmedText: { color: colors.forest },
  goal: { ...typography.body, fontFamily: fonts.bold, color: colors.ink },
  metadata: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  skill: {
    ...typography.caption,
    fontFamily: fonts.semibold,
    color: colors.warning,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: colors.amberSoft,
    flexShrink: 1,
  },
  learningSkill: { color: colors.primary, backgroundColor: colors.primarySoft },
  sessionCount: { flexDirection: "row", alignItems: "center", gap: 4 },
  secondary: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  confirmation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: appRadius.badge,
    backgroundColor: colors.forestSoft,
  },
  confirmationText: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.forest,
    flex: 1,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { flexGrow: 1, flexBasis: 120, minHeight: 44 },
  reminder: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 8,
  },
  reminderText: {
    flex: 1,
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
});
