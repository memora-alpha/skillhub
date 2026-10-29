import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { useParticipantProfile } from "@/features/connections";
import { Icon } from "@/components/Icon";
import {
  appColors as colors,
  appRadius,
  fonts,
  typography,
} from "@/constants/theme";
import type { ApiLearningPath } from "../api/learning-paths-contract";

export function AgreementMethodSummary({
  path,
  userId,
  otherId,
  otherName,
  mine,
  other,
  children,
}: Readonly<{
  path: ApiLearningPath;
  userId?: string;
  otherId: string;
  otherName: string;
  mine: boolean;
  other: boolean;
  children: ReactNode;
}>) {
  const twoWay = path.agreement.exchangeType === "TWO_WAY";
  const count = Number(mine) + Number(other);
  const assignment =
    path.agreement.teacherId === userId
      ? "Bạn dạy · Đối tác học"
      : "Đối tác dạy · Bạn học";
  const assignmentDescription = twoWay
    ? "Mỗi người tạo lộ trình mình dạy, xác nhận lộ trình mình học trước khi xếp lịch."
    : `${assignment}. Người học xác nhận lộ trình trước khi xếp lịch.`;
  return (
    <>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Thống nhất cách học
        </Text>
        <View style={styles.mode}>
          <Icon name="users" size={14} color={colors.primary} />
          <Text style={styles.modeText}>
            {twoWay ? "Trao đổi hai chiều" : "Học một chiều"}
          </Text>
        </View>
      </View>
      <View style={styles.rule}>
        <View style={styles.icon}>
          <Icon name="clipboard" size={18} color={colors.primary} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.ruleTitle}>Phân công lộ trình</Text>
          <Text style={styles.small}>{assignmentDescription}</Text>
        </View>
      </View>
      <View style={styles.credit}>
        <View style={styles.creditRow}>
          <View style={styles.grow}>
            <Text style={styles.creditLabel}>
              {twoWay ? "CREDIT CAM KẾT" : "CREDIT TOÀN LỘ TRÌNH"}
            </Text>
            <Text style={styles.amount}>
              {twoWay
                ? path.agreement.totalCreditPerUser
                : path.agreement.negotiatedCredit}
              <Text style={styles.small}>
                {" "}
                {twoWay ? "Credit / người" : "Credit"}
              </Text>
            </Text>
          </View>
          <View style={styles.creditIcon}>
            <Icon name="shield" size={20} color={colors.warning} />
          </View>
        </View>
        <View style={styles.creditNote}>
          <Icon name="lock" size={14} color={colors.forest} />
          <Text style={[styles.small, styles.grow]}>
            {twoWay
              ? "Credit chỉ tạm giữ khi chốt lịch."
              : "Chỉ người học tạm giữ khi chốt lịch."}
          </Text>
        </View>
      </View>
      <View style={styles.statusHeading}>
        <Text style={styles.sectionLabel}>TRẠNG THÁI XÁC NHẬN</Text>
        <Text style={[styles.count, count === 2 && styles.confirmedText]}>
          {count}/2 đã đồng ý
        </Text>
      </View>
      <View style={styles.people}>
        <ConfirmationPerson name="Bạn" userId={userId} confirmed={mine} />
        <ConfirmationPerson
          name={otherName}
          userId={otherId}
          confirmed={other}
        />
      </View>
      <View style={styles.actions}>{children}</View>
    </>
  );
}
function ConfirmationPerson({
  name,
  userId,
  confirmed,
}: Readonly<{ name: string; userId?: string; confirmed: boolean }>) {
  const profile = useParticipantProfile(userId);
  return (
    <View style={styles.person}>
      <Avatar
        name={name}
        userId={userId}
        size={40}
        sourceUri={profile.data?.avatarUrl}
      />
      <View style={styles.grow}>
        <Text numberOfLines={2} style={styles.personName}>
          {name}
        </Text>
      </View>
      <View style={[styles.status, confirmed && styles.confirmedStatus]}>
        <Icon
          name={confirmed ? "check-circle" : "clock"}
          size={12}
          color={confirmed ? colors.forest : colors.warning}
        />
        <Text style={[styles.statusText, confirmed && styles.confirmedText]}>
          {confirmed ? "Đã xác nhận" : "Chưa xác nhận"}
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  title: {
    ...typography.heading,
    fontFamily: fonts.bold,
    color: colors.ink,
    flexShrink: 1,
  },
  mode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: appRadius.full,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: colors.primarySoft,
  },
  modeText: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.primary,
  },
  rule: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: appRadius.card,
    backgroundColor: colors.surfaceLow,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: appRadius.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  grow: { flex: 1, minWidth: 0, gap: 3 },
  ruleTitle: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  small: {
    ...typography.secondary,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  credit: {
    padding: 16,
    borderRadius: appRadius.card,
    backgroundColor: colors.amberSoft,
    gap: 12,
  },
  creditRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  creditLabel: {
    ...typography.secondary,
    fontFamily: fonts.bold,
    color: colors.warning,
  },
  amount: {
    fontSize: 26,
    lineHeight: 34,
    fontFamily: fonts.bold,
    fontVariant: ["tabular-nums"],
    color: colors.ink,
  },
  creditIcon: {
    width: 36,
    height: 36,
    borderRadius: appRadius.full,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  creditNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingTop: 12,
  },
  statusHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  sectionLabel: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.muted,
  },
  count: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.warning,
  },
  people: { gap: 10 },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: appRadius.control,
    backgroundColor: colors.surfaceLow,
  },
  personName: {
    ...typography.body,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.amberSoft,
    borderRadius: appRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 5,
    maxWidth: "43%",
  },
  statusText: {
    ...typography.secondary,
    fontFamily: fonts.semibold,
    color: colors.warning,
    flexShrink: 1,
  },
  confirmedStatus: { backgroundColor: colors.forestSoft },
  confirmedText: { color: colors.forest },
  actions: { gap: 10, marginTop: 8 },
});
