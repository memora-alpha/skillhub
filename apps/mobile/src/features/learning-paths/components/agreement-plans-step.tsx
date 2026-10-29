import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import {
  AgreementFooter,
  agreementFooterPrimaryStyle,
} from "./agreement-footer";
import { Icon } from "@/components/Icon";

import { useCatalogName } from "@/features/connections";
import { appColors as colors } from "@/constants/theme";
import { styles } from "./agreement-plans-styles";
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
            ? "Mỗi người tạo lộ trình mình dạy; có thể cùng chuẩn bị."
            : "Người dạy tạo lộ trình, người học xác nhận trước khi xếp lịch."}
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
  const confirmed = !!plan?.learnerConfirmedAt;
  const needsAction = canCreate || (!!plan && !mine && !confirmed);
  const status = planDirectionLabel(plan, mine, canCreate, confirmed);
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
        <ExistingPlanContent
          path={path}
          plan={plan}
          mine={mine}
          confirmed={confirmed}
          canEdit={canEdit}
          blocked={blocked}
        />
      ) : (
        <MissingPlanContent
          path={path}
          mine={mine}
          partnerName={partnerName}
          canCreate={canCreate}
          blocked={blocked}
        />
      )}
    </View>
  );
}

function planDirectionLabel(
  plan: ApiLearningPlan | undefined,
  mine: boolean,
  canCreate: boolean,
  confirmed: boolean,
) {
  if (plan && confirmed) return "Đã xác nhận";
  if (plan && mine) return "Chờ người học";
  if (plan) return "Bạn cần xác nhận";
  if (mine && canCreate) return "Phần việc của bạn";
  if (mine) return "Chưa có lộ trình";
  return "Chờ đối tác tạo";
}

function ExistingPlanContent({
  path,
  plan,
  mine,
  confirmed,
  canEdit,
  blocked,
}: Readonly<{
  path: ApiLearningPath;
  plan: ApiLearningPlan;
  mine: boolean;
  confirmed: boolean;
  canEdit: boolean;
  blocked: boolean;
}>) {
  const router = useRouter();
  const skill = useCatalogName(plan.skillId);
  const needsLearnerAction = !mine && !confirmed;
  return (
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
          <Text style={styles.confirmationText}>Người học đã xác nhận</Text>
        </View>
      )}
      <View style={styles.actions}>
        <Button
          size="sm"
          variant={needsLearnerAction ? "craft" : "secondary"}
          style={styles.action}
          onPress={() => router.push(`/paths/${path.id}/plans/${plan.id}`)}
        >
          {needsLearnerAction ? "Xem và xác nhận lộ trình" : "Xem chi tiết"}
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
  );
}

function MissingPlanContent({
  path,
  mine,
  partnerName,
  canCreate,
  blocked,
}: Readonly<{
  path: ApiLearningPath;
  mine: boolean;
  partnerName: string;
  canCreate: boolean;
  blocked: boolean;
}>) {
  const router = useRouter();
  const title = mine ? "Thiết kế lộ trình bạn dạy" : "Chờ đối tác lên lộ trình";
  const description = mine
    ? "Thêm mục tiêu và nội dung cho từng buổi học."
    : `${partnerName} sẽ chuẩn bị nội dung cho chiều bạn học.`;
  return (
    <>
      <Text style={styles.goal}>{title}</Text>
      <Text style={styles.secondary}>{description}</Text>
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
  );
}
