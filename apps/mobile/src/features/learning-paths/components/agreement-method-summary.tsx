import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { appColors as colors, fonts, typography } from "@/constants/theme";
import type { ApiLearningPath } from "../api/learning-paths-contract";

export function AgreementMethodSummary({
  path,
  userId,
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
  let roleNote =
    path.agreement.teacherId === userId
      ? "Bạn dạy · Đối tác học"
      : "Đối tác dạy · Bạn học";
  if (twoWay) roleNote = "Hai bên cùng dạy và học.";
  return (
    <View style={styles.summary}>
      <View style={styles.row}>
        <Text style={styles.label}>Hình thức</Text>
        <Text style={styles.value}>
          {twoWay ? "Trao đổi hai chiều" : "Học một chiều"}
        </Text>
      </View>
      <Text style={styles.note}>{roleNote}</Text>
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>
            {twoWay ? "Credit / người" : "Credit toàn lộ trình"}
          </Text>
          <Text selectable style={styles.amount}>
            {twoWay
              ? path.agreement.totalCreditPerUser
              : path.agreement.negotiatedCredit}
          </Text>
        </View>
        <Text style={styles.note}>
          {twoWay
            ? "Credit chỉ tạm giữ khi chốt lịch."
            : "Người học tạm giữ Credit khi chốt lịch."}
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Xác nhận</Text>
        <ConfirmationPerson name="Bạn" confirmed={mine} />
        <ConfirmationPerson name={otherName} confirmed={other} />
      </View>
      {children}
    </View>
  );
}
function ConfirmationPerson({
  name,
  confirmed,
}: Readonly<{ name: string; confirmed: boolean }>) {
  return (
    <View style={styles.row}>
      <Text numberOfLines={2} style={styles.person}>
        {name}
      </Text>
      <View style={styles.confirmation}>
        <Icon
          name={confirmed ? "check-circle" : "clock"}
          size={15}
          color={confirmed ? colors.forest : colors.warning}
        />
        <Text style={[styles.status, confirmed && styles.confirmed]}>
          {confirmed ? "Đã xác nhận" : "Chưa xác nhận"}
        </Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  summary: { gap: 10 },
  section: {
    gap: 10,
    paddingTop: 14,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  label: {
    ...typography.secondary,
    fontFamily: fonts.medium,
    color: colors.muted,
  },
  value: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.ink,
    flexShrink: 1,
  },
  note: { ...typography.secondary, fontFamily: fonts.body, color: colors.body },
  amount: {
    ...typography.title,
    fontFamily: fonts.bold,
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  person: {
    ...typography.body,
    fontFamily: fonts.semibold,
    color: colors.ink,
    flexShrink: 1,
  },
  confirmation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "100%",
  },
  status: {
    ...typography.secondary,
    fontFamily: fonts.medium,
    color: colors.warning,
    flexShrink: 1,
  },
  confirmed: { color: colors.forest },
});
